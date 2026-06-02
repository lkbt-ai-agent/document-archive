from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.ai.providers import AIProviderRuntimeError
from app.api.v1.schemas import DocumentChunkRead, DocumentRead
from app.core.database import get_db
from app.db.models import Document, DocumentChunk
from app.modules.documents.service import DocumentService
from app.modules.extraction.service import SUPPORTED_EXTENSIONS
from app.modules.storage.service import StorageService


router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    folder_id: uuid.UUID | None = Form(default=None),
    db: Session = Depends(get_db),
) -> Document:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Unsupported file type. Supported types: jpg, png, webp, PDF, txt, md.")
    content = await file.read()
    try:
        document = DocumentService(db).create_uploaded_document(folder_id, file.filename or "upload", file.content_type or "application/octet-stream", content)
        db.flush()
        db.refresh(document)
        return document
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except AIProviderRuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("", response_model=list[DocumentRead])
def list_documents(
    folder_id: uuid.UUID | None = None,
    root_only: bool = False,
    db: Session = Depends(get_db),
) -> list[Document]:
    stmt = select(Document).options(selectinload(Document.metadata_row)).order_by(Document.created_at.desc())
    if root_only:
        stmt = stmt.where(Document.folder_id.is_(None))
    elif folder_id:
        stmt = stmt.where(Document.folder_id == folder_id)
    return list(db.scalars(stmt))


@router.get("/{document_id}", response_model=DocumentRead)
def get_document(document_id: uuid.UUID, db: Session = Depends(get_db)) -> Document:
    document = db.scalar(select(Document).options(selectinload(Document.metadata_row)).where(Document.id == document_id))
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")
    return document


@router.get("/{document_id}/content", response_model=list[DocumentChunkRead])
def get_document_content(document_id: uuid.UUID, db: Session = Depends(get_db)) -> list[DocumentChunk]:
    if not db.get(Document, document_id):
        raise HTTPException(status_code=404, detail="Document not found.")
    return list(db.scalars(select(DocumentChunk).where(DocumentChunk.document_id == document_id).order_by(DocumentChunk.chunk_index)))


def _original_file_response(document: Document, *, download: bool) -> FileResponse | RedirectResponse:
    storage = StorageService()
    if document.storage_bucket:
        return RedirectResponse(
            storage.presigned_url(document.storage_object_key, document.original_filename, download=download),
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
        )
    path = storage.local_path(document.storage_object_key)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Stored file not found.")
    return FileResponse(
        path,
        media_type=document.mime_type,
        filename=document.original_filename,
        content_disposition_type="attachment" if download else "inline",
    )


@router.get("/{document_id}/download", response_model=None)
def download_document(document_id: uuid.UUID, db: Session = Depends(get_db)) -> FileResponse | RedirectResponse:
    document = db.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")
    return _original_file_response(document, download=True)


@router.get("/{document_id}/view", response_model=None)
def view_document(document_id: uuid.UUID, db: Session = Depends(get_db)) -> FileResponse | RedirectResponse:
    document = db.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")
    return _original_file_response(document, download=False)


@router.post("/{document_id}/process", response_model=DocumentRead)
def process_document(document_id: uuid.UUID, db: Session = Depends(get_db)) -> Document:
    document = db.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")
    raise HTTPException(status_code=409, detail="Reprocessing stored objects is not implemented yet; upload processing runs synchronously in Phase 3.")


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    document = db.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")
    db.delete(document)
