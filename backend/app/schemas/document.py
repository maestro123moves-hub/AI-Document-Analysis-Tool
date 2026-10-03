import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class DocumentResponse(BaseModel):
    id: uuid.UUID
    filename: str
    original_filename: str
    file_type: str
    file_size_bytes: int | None = None
    page_count: int | None = None
    word_count: int | None = None
    document_type: str = "OTHER"
    summary: str | None = None
    processing_status: str = "pending"
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentUploadResponse(DocumentResponse):
    processing_time_ms: float


class DocumentDetailResponse(DocumentResponse):
    raw_text: str | None = None


class ClassificationResult(BaseModel):
    """Structured output schema for Gemini classification + summarization.

    Used as response_schema in the Gemini API call so the model is
    constrained to return valid, correctly-shaped JSON.
    """
    document_type: str
    confidence: float
    summary: str


class ProcessingResult(BaseModel):
    """Response schema for POST /api/documents/{id}/process."""
    document_type: str
    confidence: float
    summary: str
    chunk_count: int
    processing_time_ms: float
