from __future__ import annotations

import re
import time
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.ai.llama_cpp_provider import get_text_generation_provider
from app.ai.providers import AIProviderRuntimeError
from app.api.v1.schemas import AIActionRequest, GeneratedDocumentResponse, LineageRead
from app.core.database import SessionLocal, get_db
from app.db.models import Document, DocumentChunk, GeneratedDocumentLineage, GenerationOperation, ProcessingStatus
from app.modules.documents.service import DocumentService


router = APIRouter(prefix="/ai-actions", tags=["ai-actions"])

ACTION_PROMPT_CHAR_LIMIT = 1200
ACTION_SOURCE_CHAR_LIMIT = 2200
ACTION_MIN_SOURCE_CHAR_LIMIT = 600
ACTION_MAX_TOKENS = 768
ACTION_MIN_MAX_TOKENS = 384
SUMMARY_FOCUS_TERMS = [
    "일정",
    "접수",
    "신청",
    "발표",
    "계약",
    "입주",
    "서류",
    "제출",
    "필요",
    "자격",
    "우선",
    "우선순위",
    "순위",
    "선정",
    "배점",
    "공급",
]


def _source_chunks(db: Session, source_document_ids: list[uuid.UUID]) -> list[DocumentChunk]:
    stmt = (
        select(DocumentChunk)
        .where(DocumentChunk.document_id.in_(source_document_ids))
        .order_by(DocumentChunk.document_id, DocumentChunk.chunk_index)
    )
    return list(db.scalars(stmt))


def _prompt_terms(operation: GenerationOperation, prompt: str) -> list[str]:
    terms = [term for term in re.split(r"[\s,./:;()\[\]{}<>~!?'\"`|\\]+", prompt) if len(term) >= 2]
    if operation == GenerationOperation.summary:
        terms.extend(SUMMARY_FOCUS_TERMS)
    return list(dict.fromkeys(terms))


def _chunk_score(chunk: DocumentChunk, terms: list[str]) -> int:
    content = chunk.content.lower()
    return sum(content.count(term.lower()) for term in terms)


def _fit_text(text: str, remaining_chars: int) -> str:
    if remaining_chars <= 0:
        return ""
    if len(text) <= remaining_chars:
        return text
    return text[: max(0, remaining_chars - 20)].rstrip() + "\n[...truncated...]"


def _source_text(db: Session, operation: GenerationOperation, payload: AIActionRequest, source_char_limit: int) -> tuple[str, list[str]]:
    chunks = _source_chunks(db, payload.source_document_ids)
    if not any(chunk.content.strip() for chunk in chunks):
        raise HTTPException(status_code=404, detail="No extracted source text found for the selected documents.")

    terms = _prompt_terms(operation, payload.prompt)
    ranked_chunks = sorted(
        enumerate(chunks),
        key=lambda item: (_chunk_score(item[1], terms), -item[0]),
        reverse=True,
    )
    selected_indexes: set[int] = set()
    selected_chunk_ids: list[str] = []
    selected_parts: list[str] = []
    remaining_chars = source_char_limit

    for index, chunk in ranked_chunks:
        if remaining_chars <= 0:
            break
        score = _chunk_score(chunk, terms)
        if score <= 0 and selected_parts:
            continue
        part = f"[source chunk {index + 1}]\n{chunk.content.strip()}"
        fitted = _fit_text(part, remaining_chars)
        if fitted.strip():
            selected_parts.append(fitted)
            selected_indexes.add(index)
            selected_chunk_ids.append(str(chunk.id))
            remaining_chars -= len(fitted) + 2

    for index, chunk in enumerate(chunks):
        if remaining_chars <= 0:
            break
        if index in selected_indexes:
            continue
        part = f"[source chunk {index + 1}]\n{chunk.content.strip()}"
        fitted = _fit_text(part, remaining_chars)
        if fitted.strip():
            selected_parts.append(fitted)
            selected_chunk_ids.append(str(chunk.id))
            remaining_chars -= len(fitted) + 2

    return "\n\n".join(selected_parts), selected_chunk_ids


def _is_context_size_error(exc: AIProviderRuntimeError) -> bool:
    message = str(exc).lower()
    return any(
        marker in message
        for marker in (
            "context size has been exceeded",
            "context size exceeded",
            "exceed context",
            "too many tokens",
        )
    )


def _generate_output(db: Session, operation: GenerationOperation, payload: AIActionRequest, instruction: str) -> tuple[str, list[str], float, str]:
    started_at = time.perf_counter()
    provider = get_text_generation_provider()
    prompt = payload.prompt[:ACTION_PROMPT_CHAR_LIMIT]
    source_limits = [ACTION_SOURCE_CHAR_LIMIT, max(ACTION_MIN_SOURCE_CHAR_LIMIT, ACTION_SOURCE_CHAR_LIMIT // 2), ACTION_MIN_SOURCE_CHAR_LIMIT]
    max_tokens = ACTION_MAX_TOKENS
    last_context_error: AIProviderRuntimeError | None = None

    for source_char_limit in source_limits:
        source_text, source_chunk_ids = _source_text(db, operation, payload, source_char_limit) if payload.source_document_ids else ("", [])
        try:
            output = provider.complete(
                "You write clear archive documents from provided source material.",
                f"{instruction}\n\nUser prompt:\n{prompt}\n\nSource material:\n{source_text}",
                temperature=0.2,
                max_tokens=max_tokens,
            )
            elapsed_seconds = round(time.perf_counter() - started_at, 3)
            return output, source_chunk_ids, elapsed_seconds, provider.model_name
        except AIProviderRuntimeError as exc:
            if not _is_context_size_error(exc):
                raise
            last_context_error = exc
            max_tokens = max(ACTION_MIN_MAX_TOKENS, max_tokens // 2)

    raise AIProviderRuntimeError(
        "Selected source text is still too large for the local generation model context. "
        "Select fewer or shorter documents, or restart the generation provider with a larger LOCAL_AI_GENERATION_CTX_SIZE."
    ) from last_context_error


def _complete_generation_background(
    document_id: uuid.UUID,
    operation: GenerationOperation,
    payload: AIActionRequest,
    instruction: str,
) -> None:
    with SessionLocal() as db:
        try:
            document = db.get(Document, document_id)
            if not document:
                return
            document.processing_status = ProcessingStatus.processing
            document.processing_error = None
            output, source_chunk_ids, elapsed_seconds, model_name = _generate_output(db, operation, payload, instruction)
            title = f"{operation.value.replace('_', ' ').title()}"
            DocumentService(db).complete_generated_document(document, title, output, elapsed_seconds)
            lineage = GeneratedDocumentLineage(
                generated_document_id=document.id,
                source_document_ids=[str(item) for item in payload.source_document_ids],
                source_chunk_ids=source_chunk_ids,
                operation=operation,
                prompt=payload.prompt,
                model_name=model_name,
                provider_name="llama.cpp",
                generation_params={"temperature": 0.2, "style": payload.style, "elapsed_seconds": elapsed_seconds},
                workflow_dna={"runtime": "llama.cpp", "operation": operation.value, "source_count": len(payload.source_document_ids)},
            )
            db.add(lineage)
            db.commit()
        except Exception as exc:
            db.rollback()
            document = db.get(Document, document_id)
            if document:
                document.processing_status = ProcessingStatus.failed
                document.processing_error = str(exc)
                db.commit()


def _queue_generation(
    background_tasks: BackgroundTasks,
    db: Session,
    operation: GenerationOperation,
    payload: AIActionRequest,
    instruction: str,
) -> GeneratedDocumentResponse:
    try:
        title = f"{operation.value.replace('_', ' ').title()}"
        document = DocumentService(db).create_generated_document_record(payload.folder_id, title)
        document_id = document.id
        db.commit()
        background_tasks.add_task(_complete_generation_background, document_id, operation, payload, instruction)
        document = db.scalar(select(Document).options(selectinload(Document.metadata_row)).where(Document.id == document.id))
        return GeneratedDocumentResponse(document=document, output="", generation_elapsed_seconds=0)
    except AIProviderRuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/summarize", response_model=GeneratedDocumentResponse)
def summarize(
    payload: AIActionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> GeneratedDocumentResponse:
    return _queue_generation(background_tasks, db, GenerationOperation.summary, payload, "Summarize the source documents into a concise Markdown note.")


@router.post("/draft", response_model=GeneratedDocumentResponse)
def draft(
    payload: AIActionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> GeneratedDocumentResponse:
    return _queue_generation(background_tasks, db, GenerationOperation.draft, payload, "Draft a new Markdown document using the prompt and source documents.")


@router.post("/report", response_model=GeneratedDocumentResponse)
def report(
    payload: AIActionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> GeneratedDocumentResponse:
    return _queue_generation(background_tasks, db, GenerationOperation.report, payload, "Create a structured Markdown report with headings, key points, and source-grounded details.")


@router.post("/rewrite-style", response_model=GeneratedDocumentResponse)
def rewrite_style(
    payload: AIActionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> GeneratedDocumentResponse:
    style = payload.style or "clear professional"
    return _queue_generation(background_tasks, db, GenerationOperation.rewrite_style, payload, f"Rewrite the source material in this style: {style}.")


@router.post("/merge-documents", response_model=GeneratedDocumentResponse)
def merge_documents(
    payload: AIActionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> GeneratedDocumentResponse:
    return _queue_generation(background_tasks, db, GenerationOperation.merge, payload, "Merge the source documents into one coherent Markdown document.")


@router.get("/{generated_document_id}/lineage", response_model=LineageRead)
def get_lineage(generated_document_id: uuid.UUID, db: Session = Depends(get_db)) -> LineageRead:
    lineage = db.scalar(select(GeneratedDocumentLineage).where(GeneratedDocumentLineage.generated_document_id == generated_document_id))
    if not lineage:
        raise HTTPException(status_code=404, detail="Lineage not found.")
    source_document_uuids: list[uuid.UUID] = []
    for document_id in lineage.source_document_ids:
        try:
            source_document_uuids.append(uuid.UUID(document_id))
        except ValueError:
            continue
    source_documents = list(db.scalars(select(Document).where(Document.id.in_(source_document_uuids)))) if source_document_uuids else []
    documents_by_id = {str(document.id): document for document in source_documents}
    return LineageRead(
        id=lineage.id,
        generated_document_id=lineage.generated_document_id,
        source_document_ids=lineage.source_document_ids,
        source_chunk_ids=lineage.source_chunk_ids,
        source_documents=[
            {
                "id": document_id,
                "title": documents_by_id[document_id].title if document_id in documents_by_id else None,
                "corrected_filename": documents_by_id[document_id].corrected_filename if document_id in documents_by_id else None,
                "original_filename": documents_by_id[document_id].original_filename if document_id in documents_by_id else None,
            }
            for document_id in lineage.source_document_ids
        ],
        operation=lineage.operation,
        prompt=lineage.prompt,
        model_name=lineage.model_name,
        provider_name=lineage.provider_name,
        generation_params=lineage.generation_params,
        workflow_dna=lineage.workflow_dna,
        created_at=lineage.created_at,
    )
