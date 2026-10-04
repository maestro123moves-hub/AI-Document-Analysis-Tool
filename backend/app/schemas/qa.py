"""Pydantic schemas for document Q&A (RAG) endpoints."""

import uuid

from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    """Request body for single-document Q&A."""
    question: str
    top_k: int = Field(default=5, ge=1, le=20)


class SourceChunk(BaseModel):
    """A single retrieved chunk with its similarity score (single-document)."""
    chunk_index: int
    chunk_text: str
    similarity_score: float


class AskResponse(BaseModel):
    """Response for single-document Q&A."""
    answer: str
    source_chunks: list[SourceChunk]
    processing_time_ms: float


class GlobalAskRequest(BaseModel):
    """Request body for cross-document (global) Q&A."""
    question: str
    top_k: int = Field(default=5, ge=1, le=20)
    document_ids: list[uuid.UUID] | None = None


class GlobalSourceChunk(BaseModel):
    """A single retrieved chunk attributed to a specific document (global Q&A).

    This is a SEPARATE schema from SourceChunk — the global endpoint's results
    need to be attributed back to a specific document, which the single-document
    endpoint's results do not.
    """
    chunk_index: int
    chunk_text: str
    similarity_score: float
    document_id: uuid.UUID
    filename: str


class GlobalAskResponse(BaseModel):
    """Response for cross-document (global) Q&A."""
    answer: str
    source_chunks: list[GlobalSourceChunk]
    processing_time_ms: float
