import asyncio
import logging
import os
import time
import traceback
import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.database import get_db
from app.models.document import Document
from app.models.user import User
from app.schemas.document import (
    DocumentDetailResponse,
    DocumentResponse,
    DocumentUploadResponse,
)
from app.services.auth_service import get_current_user
from app.services.text_extractor import extract_text, get_page_count

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["Documents"])

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".png", ".jpg", ".jpeg", ".txt"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

# Dedicated engine with NullPool for sync route worker threads to avoid connection pool cross-loop issues
_upload_db_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
_upload_session_factory = async_sessionmaker(
    bind=_upload_db_engine,
    expire_on_commit=False,
)


async def _async_insert_document(
    user_id: uuid.UUID,
    filename: str,
    original_filename: str,
    file_type: str,
    file_size_bytes: int,
    page_count: int | None,
    word_count: int | None,
    raw_text: str | None,
    file_path: str,
) -> dict:
    async with _upload_session_factory() as session:
        doc = Document(
            user_id=user_id,
            filename=filename,
            original_filename=original_filename,
            file_type=file_type,
            file_size_bytes=file_size_bytes,
            page_count=page_count,
            word_count=word_count,
            raw_text=raw_text,
            file_path=file_path,
        )
        session.add(doc)
        await session.commit()
        await session.refresh(doc)
        return {
            "id": doc.id,
            "filename": doc.filename,
            "original_filename": doc.original_filename,
            "file_type": doc.file_type,
            "file_size_bytes": doc.file_size_bytes,
            "page_count": doc.page_count,
            "word_count": doc.word_count,
            "created_at": doc.created_at,
        }


@router.post("/upload", response_model=DocumentUploadResponse)
def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File must have a filename",
        )

    _, ext = os.path.splitext(file.filename)
    ext = ext.lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported file type '{ext}'. Allowed extensions: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # Enforce 20MB limit while reading
    total_bytes = 0
    chunks = []
    chunk_size = 1024 * 1024  # 1MB chunks

    while True:
        chunk = file.file.read(chunk_size)
        if not chunk:
            break
        total_bytes += len(chunk)
        if total_bytes > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File size exceeds maximum allowed size of 20MB",
            )
        chunks.append(chunk)

    # Save to disk first
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    saved_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, saved_filename)

    with open(file_path, "wb") as f:
        for chunk in chunks:
            f.write(chunk)

    # Extract text and insert into database
    try:
        start_time = time.perf_counter()
        raw_text = extract_text(file_path, ext)
        processing_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

        word_count = len(raw_text.split()) if raw_text else 0
        page_count = get_page_count(file_path, ext)

        doc_dict = asyncio.run(
            _async_insert_document(
                user_id=current_user.id,
                filename=saved_filename,
                original_filename=file.filename,
                file_type=ext.lstrip("."),
                file_size_bytes=total_bytes,
                page_count=page_count,
                word_count=word_count,
                raw_text=raw_text,
                file_path=file_path,
            )
        )
    except Exception as exc:
        traceback.print_exc()
        logger.exception(f"Error in upload_document: {exc}")
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as cleanup_exc:
            logger.warning(
                f"Failed to delete orphaned file {file_path} after error: {cleanup_exc}"
            )
        raise exc

    return DocumentUploadResponse(
        id=doc_dict["id"],
        filename=doc_dict["filename"],
        original_filename=doc_dict["original_filename"],
        file_type=doc_dict["file_type"],
        file_size_bytes=doc_dict["file_size_bytes"],
        page_count=doc_dict["page_count"],
        word_count=doc_dict["word_count"],
        created_at=doc_dict["created_at"],
        processing_time_ms=processing_time_ms,
    )


@router.get("/", response_model=list[DocumentResponse])
async def list_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Document)
        .where(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    documents = result.scalars().all()
    return documents


@router.get("/{id}", response_model=DocumentDetailResponse)
async def get_document(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Document).where(
        Document.id == id,
        Document.user_id == current_user.id,
    )
    result = await db.execute(query)
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )
    return document


@router.delete("/{id}")
async def delete_document(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Document).where(
        Document.id == id,
        Document.user_id == current_user.id,
    )
    result = await db.execute(query)
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    file_path = document.file_path

    # Delete database row first
    await db.delete(document)
    await db.commit()

    # Only if DB commit succeeds, delete file from disk
    if file_path:
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            logger.warning(f"Failed to delete file from disk at {file_path}: {e}")

    return {"detail": "Document deleted successfully", "id": str(id)}
