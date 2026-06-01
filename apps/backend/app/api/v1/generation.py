from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.ai.llama_cpp_provider import get_text_generation_provider
from app.ai.providers import AIProviderRuntimeError
from app.api.v1.schemas import AIActionRequest, GeneratedDocumentResponse, LineageRead
from app.core.database import get_db
from app.db.models import Document, DocumentChunk, GeneratedDocumentLineage, GenerationOperation
from app.modules.documents.service import DocumentService


router = APIRouter(prefix="/ai-actions", tags=["ai-actions"])


def _source_text(db: Session, source_document_ids: list[uuid.UUID]) -> str:
    chunks = db.scalars(
        select(DocumentChunk)
        .where(DocumentChunk.document_id.in_(source_document_ids))
        .order_by(DocumentChunk.document_id, DocumentChunk.chunk_index)
    )
    text = "\n\n".join(chunk.content for chunk in chunks)
    if not text.strip():
        raise HTTPException(status_code=404, detail="No extracted source text found for the selected documents.")
    return text


def _generate(db: Session, operation: GenerationOperation, payload: AIActionRequest, instruction: str) -> GeneratedDocumentResponse:
    try:
        provider = get_text_generation_provider()
        source_text = _source_text(db, payload.source_document_ids) if payload.source_document_ids else ""
        output = provider.complete(
            "You write clear archive documents from provided source material.",
            f"{instruction}\n\nUser prompt:\n{payload.prompt}\n\nSource material:\n{source_text[:12000]}",
            temperature=0.2,
        )
        title = f"{operation.value.replace('_', ' ').title()}"
        document = DocumentService(db).create_generated_document(payload.folder_id, title, output, [str(item) for item in payload.source_document_ids], payload.prompt, operation.value)
        lineage = GeneratedDocumentLineage(
            generated_document_id=document.id,
            source_document_ids=[str(item) for item in payload.source_document_ids],
            operation=operation,
            prompt=payload.prompt,
            model_name=provider.model_name,
            provider_name="llama.cpp",
            generation_params={"temperature": 0.2, "style": payload.style},
            workflow_dna={"runtime": "llama.cpp", "operation": operation.value, "source_count": len(payload.source_document_ids)},
        )
        db.add(lineage)
        db.flush()
        document = db.scalar(select(Document).options(selectinload(Document.metadata_row)).where(Document.id == document.id))
        return GeneratedDocumentResponse(document=document, output=output)
    except AIProviderRuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/summarize", response_model=GeneratedDocumentResponse)
def summarize(payload: AIActionRequest, db: Session = Depends(get_db)) -> GeneratedDocumentResponse:
    return _generate(db, GenerationOperation.summary, payload, "Summarize the source documents into a concise Markdown note.")


@router.post("/draft", response_model=GeneratedDocumentResponse)
def draft(payload: AIActionRequest, db: Session = Depends(get_db)) -> GeneratedDocumentResponse:
    return _generate(db, GenerationOperation.draft, payload, "Draft a new Markdown document using the prompt and source documents.")


@router.post("/report", response_model=GeneratedDocumentResponse)
def report(payload: AIActionRequest, db: Session = Depends(get_db)) -> GeneratedDocumentResponse:
    return _generate(db, GenerationOperation.report, payload, "Create a structured Markdown report with headings, key points, and source-grounded details.")


@router.post("/rewrite-style", response_model=GeneratedDocumentResponse)
def rewrite_style(payload: AIActionRequest, db: Session = Depends(get_db)) -> GeneratedDocumentResponse:
    style = payload.style or "clear professional"
    return _generate(db, GenerationOperation.rewrite_style, payload, f"Rewrite the source material in this style: {style}.")


@router.post("/merge-documents", response_model=GeneratedDocumentResponse)
def merge_documents(payload: AIActionRequest, db: Session = Depends(get_db)) -> GeneratedDocumentResponse:
    return _generate(db, GenerationOperation.merge, payload, "Merge the source documents into one coherent Markdown document.")


@router.get("/{generated_document_id}/lineage", response_model=LineageRead)
def get_lineage(generated_document_id: uuid.UUID, db: Session = Depends(get_db)) -> GeneratedDocumentLineage:
    lineage = db.scalar(select(GeneratedDocumentLineage).where(GeneratedDocumentLineage.generated_document_id == generated_document_id))
    if not lineage:
        raise HTTPException(status_code=404, detail="Lineage not found.")
    return lineage
