"""Q&A router — RAG-based document question answering."""

import asyncio
import logging
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.user import User
from app.schemas.qa import (
    AskRequest,
    AskResponse,
    GlobalAskRequest,
    GlobalAskResponse,
    GlobalSourceChunk,
    SourceChunk,
)
from app.services.ai_service import embed_query, generate_answer
from app.services.auth_service import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["Q&A"])

# Dedicated engine with NullPool for sync route worker threads — same
# pattern as Upload and Processing routers, avoids connection pool
# cross-loop issues when asyncio.run() is called from a worker thread
_qa_db_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
_qa_session_factory = async_sessionmaker(
    bind=_qa_db_engine,
    expire_on_commit=False,
)


# ---------------------------------------------------------------------------
# Internal async helpers (called via asyncio.run from sync route handlers)
# ---------------------------------------------------------------------------

async def _async_get_document(document_id: uuid.UUID, user_id: uuid.UUID) -> Document | None:
    """Fetch a document by ID and owner from a dedicated session."""
    async with _qa_session_factory() as session:
        query = select(Document).where(
            Document.id == document_id,
            Document.user_id == user_id,
        )
        result = await session.execute(query)
        return result.scalar_one_or_none()


async def _async_retrieve_chunks(
    document_id: uuid.UUID,
    query_embedding: list[float],
    top_k: int,
) -> list[dict]:
    """Retrieve the top-k most similar chunks for a single document.

    Computes similarity_score as (1 - cosine_distance) so that HIGHER values
    indicate a better match. Orders by cosine_distance ascending (closest
    first) then limits to top_k.
    """
    async with _qa_session_factory() as session:
        similarity_expr = (
            1 - DocumentChunk.embedding.cosine_distance(query_embedding)
        )
        query = (
            select(
                DocumentChunk.chunk_index,
                DocumentChunk.chunk_text,
                similarity_expr.label("similarity_score"),
            )
            .where(DocumentChunk.document_id == document_id)
            .order_by(DocumentChunk.embedding.cosine_distance(query_embedding).asc())
            .limit(top_k)
        )
        result = await session.execute(query)
        rows = result.all()
        return [
            {
                "chunk_index": row.chunk_index,
                "chunk_text": row.chunk_text,
                "similarity_score": float(row.similarity_score),
            }
            for row in rows
        ]


async def _async_retrieve_global_chunks(
    user_id: uuid.UUID,
    query_embedding: list[float],
    top_k: int,
    document_ids: list[uuid.UUID] | None = None,
) -> list[dict]:
    """Retrieve the top-k most similar chunks across the user's documents.

    Filters explicitly on:
      - documents.user_id = current user (ownership guard)
      - documents.processing_status = 'completed' (explicit, not implicit)
      - documents.id IN document_ids (if provided)

    Returns each chunk with its document_id and filename for attribution.
    """
    async with _qa_session_factory() as session:
        similarity_expr = (
            1 - DocumentChunk.embedding.cosine_distance(query_embedding)
        )
        query = (
            select(
                DocumentChunk.chunk_index,
                DocumentChunk.chunk_text,
                similarity_expr.label("similarity_score"),
                Document.id.label("document_id"),
                Document.original_filename.label("filename"),
            )
            .join(Document, DocumentChunk.document_id == Document.id)
            .where(
                Document.user_id == user_id,
                Document.processing_status == "completed",
            )
            .order_by(DocumentChunk.embedding.cosine_distance(query_embedding).asc())
            .limit(top_k)
        )

        # Optionally filter to a specific set of document IDs
        if document_ids:
            query = query.where(Document.id.in_(document_ids))

        result = await session.execute(query)
        rows = result.all()
        return [
            {
                "chunk_index": row.chunk_index,
                "chunk_text": row.chunk_text,
                "similarity_score": float(row.similarity_score),
                "document_id": row.document_id,
                "filename": row.filename,
            }
            for row in rows
        ]


async def _async_user_has_completed_docs(
    user_id: uuid.UUID,
    document_ids: list[uuid.UUID] | None = None,
) -> bool:
    """Check whether the user has any completed documents matching the filter."""
    async with _qa_session_factory() as session:
        query = (
            select(Document.id)
            .where(
                Document.user_id == user_id,
                Document.processing_status == "completed",
            )
            .limit(1)
        )
        if document_ids:
            query = query.where(Document.id.in_(document_ids))
        result = await session.execute(query)
        return result.scalar_one_or_none() is not None


# ---------------------------------------------------------------------------
# Helper: question validation
# ---------------------------------------------------------------------------

def _validate_question(question: str) -> None:
    """Validate the question string — non-empty and ≤1000 chars."""
    stripped = question.strip()
    if not stripped:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Question must not be empty",
        )
    if len(stripped) > 1000:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Question must be 1000 characters or fewer",
        )


# ---------------------------------------------------------------------------
# Helper: build context string from chunks
# ---------------------------------------------------------------------------

def _build_context(chunks: list[dict]) -> str:
    """Join chunk texts with clear separators for the generation prompt."""
    sections = []
    for i, chunk in enumerate(chunks, start=1):
        sections.append(f"--- Chunk {i} ---\n{chunk['chunk_text']}")
    return "\n\n".join(sections)


# ---------------------------------------------------------------------------
# Routes (plain `def` — runs in FastAPI's worker thread pool)
# ---------------------------------------------------------------------------

@router.post("/{id}/ask", response_model=AskResponse)
def ask_document(
    id: uuid.UUID,
    request: AskRequest,
    current_user: User = Depends(get_current_user),
):
    """Ask a question about a single document using RAG.

    This is a plain `def` route (not async def) so it runs in FastAPI's worker
    thread pool, preventing blocking Gemini SDK calls from freezing the event
    loop — same pattern as Upload and Processing routes.
    """
    start_time = time.perf_counter()

    # --- Question validation ---
    _validate_question(request.question)

    # --- Ownership check ---
    document = asyncio.run(_async_get_document(id, current_user.id))
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    # --- Processing status check ---
    if document.processing_status != "completed":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This document hasn't been processed yet — process it first before asking questions",
        )

    # --- Embed the question ---
    try:
        query_embedding = embed_query(request.question.strip())
    except Exception as exc:
        logger.error(f"Failed to embed question: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to generate question embedding: {str(exc)}",
        )

    # --- Retrieve similar chunks ---
    retrieved = asyncio.run(
        _async_retrieve_chunks(id, query_embedding, request.top_k)
    )

    # Guard: no chunks found (shouldn't happen for completed doc, but be safe)
    if not retrieved:
        processing_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return AskResponse(
            answer="No content is available for this document to answer questions from.",
            source_chunks=[],
            processing_time_ms=processing_time_ms,
        )

    # --- Generate answer ---
    context = _build_context(retrieved)
    try:
        answer = generate_answer(request.question.strip(), context)
    except Exception as exc:
        logger.error(f"Gemini answer generation failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Answer generation failed: {str(exc)}",
        )

    processing_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

    return AskResponse(
        answer=answer,
        source_chunks=[
            SourceChunk(
                chunk_index=c["chunk_index"],
                chunk_text=c["chunk_text"],
                similarity_score=c["similarity_score"],
            )
            for c in retrieved
        ],
        processing_time_ms=processing_time_ms,
    )


@router.post("/ask", response_model=GlobalAskResponse)
def ask_global(
    request: GlobalAskRequest,
    current_user: User = Depends(get_current_user),
):
    """Ask a question across all (or a subset of) the user's documents using RAG.

    Also a plain `def` route for the same blocking-call reason as above.
    """
    start_time = time.perf_counter()

    # --- Question validation ---
    _validate_question(request.question)

    # --- Check if user has any completed docs matching the filter ---
    has_docs = asyncio.run(
        _async_user_has_completed_docs(current_user.id, request.document_ids)
    )
    if not has_docs:
        processing_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return GlobalAskResponse(
            answer="You don't have any processed documents to search yet. Upload and process some documents first.",
            source_chunks=[],
            processing_time_ms=processing_time_ms,
        )

    # --- Embed the question ---
    try:
        query_embedding = embed_query(request.question.strip())
    except Exception as exc:
        logger.error(f"Failed to embed question: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to generate question embedding: {str(exc)}",
        )

    # --- Retrieve similar chunks across documents ---
    retrieved = asyncio.run(
        _async_retrieve_global_chunks(
            current_user.id, query_embedding, request.top_k, request.document_ids
        )
    )

    # Guard: no chunks returned (all completed docs may have had empty text)
    if not retrieved:
        processing_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return GlobalAskResponse(
            answer="No content is available across your documents to answer this question.",
            source_chunks=[],
            processing_time_ms=processing_time_ms,
        )

    # --- Generate answer ---
    context = _build_context(retrieved)
    try:
        answer = generate_answer(request.question.strip(), context)
    except Exception as exc:
        logger.error(f"Gemini answer generation failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Answer generation failed: {str(exc)}",
        )

    processing_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

    return GlobalAskResponse(
        answer=answer,
        source_chunks=[
            GlobalSourceChunk(
                chunk_index=c["chunk_index"],
                chunk_text=c["chunk_text"],
                similarity_score=c["similarity_score"],
                document_id=c["document_id"],
                filename=c["filename"],
            )
            for c in retrieved
        ],
        processing_time_ms=processing_time_ms,
    )
