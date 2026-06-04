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

ACTION_PROMPT_CHAR_LIMIT = 2000
ACTION_SOURCE_CHAR_LIMIT = 8000
ACTION_MIN_SOURCE_CHAR_LIMIT = 1200
ACTION_MAX_TOKENS = 3072
ACTION_MIN_MAX_TOKENS = 768
ACTION_OPERATION_LIMITS = {
    GenerationOperation.summary: {"source_char_limit": 8000, "max_tokens": 2048},
    GenerationOperation.draft: {"source_char_limit": 10000, "max_tokens": 3072},
    GenerationOperation.report: {"source_char_limit": 12000, "max_tokens": 4096},
    GenerationOperation.rewrite_style: {"source_char_limit": 10000, "max_tokens": 3072},
    GenerationOperation.merge: {"source_char_limit": 12000, "max_tokens": 4096},
}
TITLE_MAX_CHARS = 60
TITLE_OUTPUT_PREVIEW_CHARS = 1800
TITLE_PROMPT_PREVIEW_CHARS = 500
TITLE_SOURCE_TITLE_LIMIT = 6
OPERATION_LABELS = {
    GenerationOperation.summary: "요약",
    GenerationOperation.draft: "초안 작성",
    GenerationOperation.report: "보고서 작성",
    GenerationOperation.rewrite_style: "문체 변경",
    GenerationOperation.merge: "문서 병합",
    GenerationOperation.generated_from_prompt: "문서 생성",
}
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


def _operation_label(operation: GenerationOperation) -> str:
    return OPERATION_LABELS.get(operation, operation.value.replace("_", " ").title())


def _source_document_titles(db: Session, source_document_ids: list[uuid.UUID]) -> list[str]:
    if not source_document_ids:
        return []
    documents = list(db.scalars(select(Document).where(Document.id.in_(source_document_ids))))
    documents_by_id = {document.id: document for document in documents}
    titles: list[str] = []
    for document_id in source_document_ids:
        document = documents_by_id.get(document_id)
        if not document:
            continue
        title = document.title or document.corrected_filename or document.original_filename
        if title:
            titles.append(title)
    return titles[:TITLE_SOURCE_TITLE_LIMIT]


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


def _clean_generated_title(title: str) -> str:
    cleaned = title.strip()
    cleaned = cleaned.removeprefix("```text").removeprefix("```").removesuffix("```").strip()
    cleaned = cleaned.strip("\"'`“”‘’")
    cleaned = re.sub(r"[\x00-\x1f<>:\"/\\|?*#`]+", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .-_")
    if cleaned.lower().endswith(".md"):
        cleaned = cleaned[:-3].rstrip(" .-_")
    return cleaned[:TITLE_MAX_CHARS].strip(" .-_")


def _fallback_title(operation: GenerationOperation, prompt: str, source_titles: list[str]) -> str:
    label = _operation_label(operation)
    prompt_title = _clean_generated_title(prompt[:TITLE_MAX_CHARS])
    if prompt_title:
        return _clean_generated_title(f"{label} - {prompt_title}")
    if source_titles:
        return _clean_generated_title(f"{label} - {source_titles[0]}")
    return label


def _generate_title(
    db: Session,
    operation: GenerationOperation,
    payload: AIActionRequest,
    output: str,
) -> tuple[str, dict[str, object]]:
    provider = get_text_generation_provider()
    source_titles = _source_document_titles(db, payload.source_document_ids)
    fallback = _fallback_title(operation, payload.prompt, source_titles)
    prompt = payload.prompt[:TITLE_PROMPT_PREVIEW_CHARS].strip()
    output_preview = output[:TITLE_OUTPUT_PREVIEW_CHARS].strip()

    try:
        raw_title = provider.complete(
            "You create short Korean document titles for an archive.",
            (
                "Return only one title. Do not use Markdown, quotes, or a file extension. "
                f"Keep it around 40 Korean characters and no longer than {TITLE_MAX_CHARS} characters. "
                "Reflect the action, user intent, source titles, and generated document topic.\n\n"
                f"Action: {_operation_label(operation)}\n"
                f"User prompt: {prompt or '(none)'}\n"
                f"Source titles: {', '.join(source_titles) if source_titles else '(none)'}\n"
                f"Generated document preview:\n{output_preview}"
            ),
            temperature=0.1,
            max_tokens=96,
        )
        title = _clean_generated_title(raw_title)
        if title:
            return title, {"title_source": "ai", "title_prompt_used": bool(prompt)}
    except AIProviderRuntimeError:
        pass

    return fallback, {"title_source": "fallback", "title_prompt_used": bool(prompt)}


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


def _source_limits(initial_limit: int) -> list[int]:
    candidates = [
        initial_limit,
        max(ACTION_MIN_SOURCE_CHAR_LIMIT, initial_limit * 2 // 3),
        max(ACTION_MIN_SOURCE_CHAR_LIMIT, initial_limit // 2),
        max(ACTION_MIN_SOURCE_CHAR_LIMIT, initial_limit // 3),
        ACTION_MIN_SOURCE_CHAR_LIMIT,
    ]
    return list(dict.fromkeys(candidates))


def _operation_limits(operation: GenerationOperation) -> tuple[int, int]:
    limits = ACTION_OPERATION_LIMITS.get(operation, {})
    return int(limits.get("source_char_limit", ACTION_SOURCE_CHAR_LIMIT)), int(limits.get("max_tokens", ACTION_MAX_TOKENS))


def _generate_output(
    db: Session,
    operation: GenerationOperation,
    payload: AIActionRequest,
    instruction: str,
) -> tuple[str, list[str], float, str, int, int]:
    started_at = time.perf_counter()
    provider = get_text_generation_provider()
    prompt = payload.prompt[:ACTION_PROMPT_CHAR_LIMIT]
    source_char_limit, max_tokens = _operation_limits(operation)
    source_limits = _source_limits(source_char_limit)
    last_context_error: AIProviderRuntimeError | None = None

    for source_char_limit in source_limits:
        source_text, source_chunk_ids = _source_text(db, operation, payload, source_char_limit) if payload.source_document_ids else ("", [])
        current_max_tokens = max_tokens
        try:
            output = provider.complete(
                "You write clear archive documents from provided source material.",
                (
                    f"{instruction}\n"
                    "Return a complete Markdown document. Do not stop mid-sentence or leave an unfinished section.\n\n"
                    f"User prompt:\n{prompt}\n\nSource material:\n{source_text}"
                ),
                temperature=0.2,
                max_tokens=current_max_tokens,
            )
            elapsed_seconds = round(time.perf_counter() - started_at, 3)
            return output, source_chunk_ids, elapsed_seconds, provider.model_name, source_char_limit, current_max_tokens
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
            output, source_chunk_ids, elapsed_seconds, model_name, source_char_limit, max_tokens = _generate_output(db, operation, payload, instruction)
            title, title_generation = _generate_title(db, operation, payload, output)
            DocumentService(db).complete_generated_document(document, title, output, elapsed_seconds)
            lineage = GeneratedDocumentLineage(
                generated_document_id=document.id,
                source_document_ids=[str(item) for item in payload.source_document_ids],
                source_chunk_ids=source_chunk_ids,
                operation=operation,
                prompt=payload.prompt,
                model_name=model_name,
                provider_name="llama.cpp",
                generation_params={
                    "temperature": 0.2,
                    "style": payload.style,
                    "elapsed_seconds": elapsed_seconds,
                    "source_char_limit": source_char_limit,
                    "max_tokens": max_tokens,
                },
                workflow_dna={
                    "runtime": "llama.cpp",
                    "operation": operation.value,
                    "source_count": len(payload.source_document_ids),
                    **title_generation,
                },
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
        title = _operation_label(operation)
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
