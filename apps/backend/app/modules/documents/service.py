from __future__ import annotations

import hashlib
from pathlib import Path
import re
import uuid

from sqlalchemy.orm import Session

from app.ai.llama_cpp_provider import get_embedding_provider, get_ocr_provider, get_text_generation_provider
from app.db.models import Document, DocumentChunk, DocumentMetadata, DocumentSourceType, Folder, ProcessingStatus
from app.modules.extraction.service import TextExtractionService, chunk_text
from app.modules.storage.service import StorageService


def corrected_filename_from_title(title: str, original_filename: str) -> str:
    suffix = Path(original_filename).suffix
    stem = re.sub(r"[\x00-\x1f<>:\"/\\|?*]+", " ", title)
    stem = re.sub(r"\s+", " ", stem).strip(" .")
    if not stem:
        stem = Path(original_filename).stem or "document"
    if suffix and stem.lower().endswith(suffix.lower()):
        return stem[:512]
    return f"{stem}{suffix}"[:512]


class DocumentService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_uploaded_document(self, folder_id: uuid.UUID | None, filename: str, mime_type: str, content: bytes) -> Document:
        document = self.create_uploaded_document_record(folder_id, filename, mime_type, content)
        self._process_document(document, content)
        return document

    def create_uploaded_document_record(self, folder_id: uuid.UUID | None, filename: str, mime_type: str, content: bytes) -> Document:
        if folder_id and not self.db.get(Folder, folder_id):
            raise ValueError("Folder not found.")
        document_id = uuid.uuid4()
        storage_bucket, storage_key = StorageService().save(filename, content, mime_type, category="originals", document_id=document_id)
        document = Document(
            id=document_id,
            folder_id=folder_id,
            original_filename=filename,
            mime_type=mime_type,
            file_size=len(content),
            checksum_sha256=hashlib.sha256(content).hexdigest(),
            storage_bucket=storage_bucket,
            storage_object_key=storage_key,
            source_type=DocumentSourceType.uploaded,
            processing_status=ProcessingStatus.processing,
        )
        self.db.add(document)
        self.db.flush()
        return document

    def create_generated_document(
        self,
        folder_id: uuid.UUID | None,
        title: str,
        content_text: str,
        source_document_ids: list[str],
        prompt: str,
        operation: str,
        elapsed_seconds: float | None = None,
    ) -> Document:
        content = content_text.encode("utf-8")
        document_id = uuid.uuid4()
        storage_bucket, storage_key = StorageService().save(f"{title}.md", content, "text/markdown", category="generated", document_id=document_id)
        document = Document(
            id=document_id,
            folder_id=folder_id,
            title=title,
            corrected_filename=f"{title}.md",
            original_filename=f"{title}.md",
            mime_type="text/markdown",
            file_size=len(content),
            checksum_sha256=hashlib.sha256(content).hexdigest(),
            storage_bucket=storage_bucket,
            storage_object_key=storage_key,
            is_generated=True,
            source_type=DocumentSourceType.generated,
            processing_status=ProcessingStatus.processing,
            upload_elapsed_seconds=elapsed_seconds,
        )
        self.db.add(document)
        self.db.flush()
        self._index_generated_text(document, content_text)
        return document

    def create_generated_document_record(self, folder_id: uuid.UUID | None, title: str) -> Document:
        if folder_id and not self.db.get(Folder, folder_id):
            raise ValueError("Folder not found.")
        content = b""
        document_id = uuid.uuid4()
        filename = f"{title}.md"
        storage_bucket, storage_key = StorageService().save(filename, content, "text/markdown", category="generated", document_id=document_id)
        document = Document(
            id=document_id,
            folder_id=folder_id,
            title=title,
            corrected_filename=filename,
            original_filename=filename,
            mime_type="text/markdown",
            file_size=0,
            checksum_sha256=hashlib.sha256(content).hexdigest(),
            storage_bucket=storage_bucket,
            storage_object_key=storage_key,
            is_generated=True,
            source_type=DocumentSourceType.generated,
            processing_status=ProcessingStatus.processing,
        )
        self.db.add(document)
        self.db.flush()
        return document

    def complete_generated_document(self, document: Document, title: str, content_text: str, elapsed_seconds: float) -> None:
        content = content_text.encode("utf-8")
        filename = f"{title}.md"
        storage_bucket, storage_key = StorageService().save(filename, content, "text/markdown", category="generated", document_id=document.id)
        document.title = title
        document.corrected_filename = filename
        document.original_filename = filename
        document.file_size = len(content)
        document.checksum_sha256 = hashlib.sha256(content).hexdigest()
        document.storage_bucket = storage_bucket
        document.storage_object_key = storage_key
        document.upload_elapsed_seconds = elapsed_seconds
        self._index_generated_text(document, content_text)

    def _process_document(self, document: Document, content: bytes) -> None:
        try:
            extractor = TextExtractionService(get_ocr_provider())
            text = extractor.extract(content, document.original_filename, document.mime_type)
            self._index_text(document, text)
        except Exception as exc:
            document.processing_status = ProcessingStatus.failed
            document.processing_error = str(exc)
            raise

    def _index_text(self, document: Document, text: str) -> None:
        generation = get_text_generation_provider()
        embedding = get_embedding_provider()
        metadata = generation.generate_metadata(text)
        document.title = metadata.title
        document.corrected_filename = corrected_filename_from_title(metadata.title, document.original_filename)
        self.db.add(
            DocumentMetadata(
                document_id=document.id,
                summary=metadata.summary,
                tags=metadata.tags,
                language=metadata.language,
                document_type=metadata.document_type,
                people=metadata.people or [],
                organizations=metadata.organizations or [],
                key_dates=metadata.key_dates or [],
                model_name=generation.model_name,
            )
        )
        chunks = chunk_text(text)
        vectors = embedding.embed(chunks) if chunks else []
        for index, chunk in enumerate(chunks):
            self.db.add(
                DocumentChunk(
                    document_id=document.id,
                    chunk_index=index,
                    content=chunk,
                    token_count=len(chunk.split()),
                    embedding=vectors[index],
                    embedding_model=embedding.model_name,
                )
            )
        document.processing_status = ProcessingStatus.ready
        document.processing_error = None

    def _index_generated_text(self, document: Document, text: str) -> None:
        embedding = get_embedding_provider()
        self.db.add(
            DocumentMetadata(
                document_id=document.id,
                summary=text[:1000],
                tags=[],
                language="ko",
                document_type="generated",
                people=[],
                organizations=[],
                key_dates=[],
                model_name="generated",
            )
        )
        chunks = chunk_text(text)
        vectors = embedding.embed(chunks) if chunks else []
        for index, chunk in enumerate(chunks):
            self.db.add(
                DocumentChunk(
                    document_id=document.id,
                    chunk_index=index,
                    content=chunk,
                    token_count=len(chunk.split()),
                    embedding=vectors[index],
                    embedding_model=embedding.model_name,
                )
            )
        document.processing_status = ProcessingStatus.ready
        document.processing_error = None
