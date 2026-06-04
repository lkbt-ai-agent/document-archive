from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    parent_id: uuid.UUID | None = None


class FolderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    parent_id: uuid.UUID | None = None


class FolderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    parent_id: uuid.UUID | None
    name: str
    path: str | None
    created_at: datetime
    updated_at: datetime


class DocumentMetadataRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    summary: str | None
    tags: list[str]
    language: str | None
    document_type: str | None
    people: list[str]
    organizations: list[str]
    key_dates: list[str]
    model_name: str
    model_version: str | None
    generated_at: datetime


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    folder_id: uuid.UUID | None
    title: str | None
    corrected_filename: str | None
    original_filename: str
    mime_type: str
    file_size: int
    checksum_sha256: str
    storage_bucket: str | None
    storage_object_key: str
    is_generated: bool
    source_type: str
    processing_status: str
    processing_error: str | None
    upload_elapsed_seconds: float | None
    created_at: datetime
    updated_at: datetime
    metadata_row: DocumentMetadataRead | None = None


class DocumentChunkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_id: uuid.UUID
    chunk_index: int
    content: str
    token_count: int | None


class KeywordSearchRequest(BaseModel):
    query: str = Field(min_length=1)
    folder_id: uuid.UUID | None = None
    root_only: bool = False
    limit: int = Field(default=20, ge=1, le=100)


class SemanticSearchRequest(BaseModel):
    query: str = Field(min_length=1)
    folder_id: uuid.UUID | None = None
    root_only: bool = False
    limit: int = Field(default=10, ge=1, le=50)


class RagSearchRequest(SemanticSearchRequest):
    pass


class SearchResult(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    title: str | None
    corrected_filename: str | None = None
    content: str
    score: float | None = None


class RagCitation(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    title: str | None
    corrected_filename: str | None = None
    content: str
    score: float | None = None


class RagSearchResponse(BaseModel):
    answer: str
    citations: list[RagCitation]


class AIActionRequest(BaseModel):
    folder_id: uuid.UUID
    source_document_ids: list[uuid.UUID] = Field(default_factory=list)
    prompt: str = Field(default="", max_length=12000)
    style: str | None = None


class GeneratedDocumentResponse(BaseModel):
    document: DocumentRead
    output: str
    generation_elapsed_seconds: float


class LineageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    generated_document_id: uuid.UUID
    source_document_ids: list[str]
    source_chunk_ids: list[str]
    operation: str
    prompt: str
    model_name: str
    provider_name: str
    generation_params: dict
    workflow_dna: dict
    created_at: datetime
