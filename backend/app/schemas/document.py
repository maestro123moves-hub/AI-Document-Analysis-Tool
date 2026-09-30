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
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentUploadResponse(DocumentResponse):
    processing_time_ms: float


class DocumentDetailResponse(DocumentResponse):
    raw_text: str | None = None
