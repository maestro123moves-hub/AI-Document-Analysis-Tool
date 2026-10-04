"""Processing router — AI classification, summarization, and embedding generation."""

import asyncio
import logging
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.user import User
from app.schemas.document import ProcessingResult
from app.services.ai_service import chunk_text, classify_and_summarize, embed_chunk
from app.services.auth_service import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["Processing"])

# Dedicated engine with NullPool for sync route worker threads — same
# pattern as the upload router, avoids connection pool cross-loop issues
_processing_db_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
_processing_session_factory = async_sessionmaker(
    bind=_processing_db_engine,
    expire_on_commit=False,
)


async def _async_get_document(document_id: uuid.UUID, user_id: uuid.UUID) -> Document | None:
    """Fetch a document by ID and owner from a dedicated session."""
    async with _processing_session_factory() as session:
        query = select(Document).where(
            Document.id == document_id,
            Document.user_id == user_id,
        )
        result = await session.execute(query)
        return result.scalar_one_or_none()


async def _async_set_status(document_id: uuid.UUID, status_value: str) -> None:
    """Set processing_status on a document and commit immediately."""
    async with _processing_session_factory() as session:
        query = select(Document).where(Document.id == document_id)
        result = await session.execute(query)
        doc = result.scalar_one()
        doc.processing_status = status_value
        await session.commit()


async def _async_save_results(
    document_id: uuid.UUID,
    document_type: str,
    summary: str,
    confidence: float,
    chunks: list[dict],
) -> None:
    """Save classification results and embedding chunks to the database.

    Deletes any existing chunks for this document before inserting new ones
    (idempotent re-processing).
    """
    async with _processing_session_factory() as session:
        # Update document fields
        query = select(Document).where(Document.id == document_id)
        result = await session.execute(query)
        doc = result.scalar_one()
        doc.document_type = document_type
        doc.summary = summary
        doc.classification_confidence = confidence
        doc.processing_status = "completed"

        # Delete old chunks (re-processing safety)
        await session.execute(
            delete(DocumentChunk).where(DocumentChunk.document_id == document_id)
        )

        # Insert new chunks
        for chunk_data in chunks:
            chunk = DocumentChunk(
                document_id=document_id,
                chunk_index=chunk_data["chunk_index"],
                chunk_text=chunk_data["chunk_text"],
                embedding=chunk_data["embedding"],
            )
            session.add(chunk)

        await session.commit()


@router.post("/{id}/process", response_model=ProcessingResult)
def process_document(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
):
    """AI-process a document: classify, summarize, chunk, and generate embeddings.

    This is a plain `def` route (not async def) so it runs in FastAPI's worker
    thread pool, preventing blocking Gemini SDK calls from freezing the event
    loop for other users — same pattern as the upload/OCR route.
    """
    start_time = time.perf_counter()

    # --- Ownership check ---
    document = asyncio.run(_async_get_document(id, current_user.id))
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    if not document.raw_text or not document.raw_text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Document has no extracted text to process",
        )

    # --- Set status to 'processing' immediately ---
    try:
        asyncio.run(_async_set_status(id, "processing"))
    except Exception as exc:
        logger.error(f"Failed to set processing status: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to initiate document processing",
        )

    try:
        # --- Classification + Summarization ---
        classification = classify_and_summarize(document.raw_text)
        doc_type = classification["document_type"]
        confidence = classification["confidence"]
        summary = classification["summary"]

        # --- Chunking + Embedding ---
        text_chunks = chunk_text(document.raw_text)
        chunk_records: list[dict] = []
        for i, chunk in enumerate(text_chunks):
            embedding = embed_chunk(chunk)
            chunk_records.append({
                "chunk_index": i,
                "chunk_text": chunk,
                "embedding": embedding,
            })

        # --- Save results ---
        asyncio.run(_async_save_results(
            document_id=id,
            document_type=doc_type,
            summary=summary,
            confidence=confidence,
            chunks=chunk_records,
        ))

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Document processing failed for {id}: {exc}")
        # Mark as failed so it's not stuck on 'processing'
        try:
            asyncio.run(_async_set_status(id, "failed"))
        except Exception as status_exc:
            logger.error(f"Failed to set 'failed' status: {status_exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Document processing failed: {str(exc)}",
        )

    processing_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

    return ProcessingResult(
        document_type=doc_type,
        confidence=confidence,
        summary=summary,
        chunk_count=len(chunk_records),
        processing_time_ms=processing_time_ms,
    )
