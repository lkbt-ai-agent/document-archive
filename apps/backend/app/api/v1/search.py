from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from sqlalchemy.sql import Select

from app.ai.llama_cpp_provider import get_embedding_provider, get_text_generation_provider
from app.ai.providers import AIProviderRuntimeError
from app.api.v1.schemas import KeywordSearchRequest, RagCitation, RagSearchRequest, RagSearchResponse, SearchResult, SemanticSearchRequest
from app.core.database import get_db
from app.db.models import Document, DocumentChunk, ProcessingStatus


router = APIRouter(prefix="/search", tags=["search"])


def _apply_keyword_filters(stmt: Select, payload: KeywordSearchRequest) -> Select:
    if payload.file_types:
        file_type_conditions = []
        if "pdf" in payload.file_types:
            file_type_conditions.append(Document.mime_type == "application/pdf")
        if "image" in payload.file_types:
            file_type_conditions.append(Document.mime_type.like("image/%"))
        if "text" in payload.file_types:
            file_type_conditions.append(
                or_(
                    Document.mime_type.like("text/%"),
                    Document.mime_type.in_(
                        [
                            "application/markdown",
                            "application/x-markdown",
                        ]
                    ),
                )
            )
        if file_type_conditions:
            stmt = stmt.where(or_(*file_type_conditions))

    if payload.processing_statuses is None:
        stmt = stmt.where(Document.processing_status == ProcessingStatus.ready)
    elif payload.processing_statuses:
        stmt = stmt.where(Document.processing_status.in_(payload.processing_statuses))

    if payload.created_from:
        stmt = stmt.where(Document.created_at >= payload.created_from)
    if payload.created_to:
        stmt = stmt.where(Document.created_at <= payload.created_to)
    return stmt


def _semantic_search_results(payload: SemanticSearchRequest, db: Session) -> list[SearchResult]:
    vector = get_embedding_provider().embed([payload.query])[0]
    distance = DocumentChunk.embedding.cosine_distance(vector)
    stmt = (
        select(DocumentChunk, Document, distance.label("distance"))
        .join(Document, Document.id == DocumentChunk.document_id)
        .where(Document.processing_status == ProcessingStatus.ready)
        .where(DocumentChunk.embedding.is_not(None))
        .order_by(distance)
        .limit(payload.limit)
    )
    if payload.root_only:
        stmt = stmt.where(Document.folder_id.is_(None))
    elif payload.folder_id:
        stmt = stmt.where(Document.folder_id == payload.folder_id)
    results: list[SearchResult] = []
    for chunk, document, dist in db.execute(stmt).all():
        results.append(
            SearchResult(
                chunk_id=chunk.id,
                document_id=document.id,
                title=document.title,
                corrected_filename=document.corrected_filename,
                content=chunk.content,
                score=float(1 - dist),
            )
        )
    return results


@router.post("/keyword", response_model=list[SearchResult])
def keyword_search(payload: KeywordSearchRequest, db: Session = Depends(get_db)) -> list[SearchResult]:
    stmt = (
        select(DocumentChunk, Document)
        .join(Document, Document.id == DocumentChunk.document_id)
        .where(DocumentChunk.content.ilike(f"%{payload.query}%"))
        .limit(payload.limit)
    )
    stmt = _apply_keyword_filters(stmt, payload)
    return [
        SearchResult(
            chunk_id=chunk.id,
            document_id=document.id,
            title=document.title,
            corrected_filename=document.corrected_filename,
            content=chunk.content,
            score=None,
        )
        for chunk, document in db.execute(stmt).all()
    ]


@router.post("/semantic", response_model=list[SearchResult])
def semantic_search(payload: SemanticSearchRequest, db: Session = Depends(get_db)) -> list[SearchResult]:
    try:
        return _semantic_search_results(payload, db)
    except AIProviderRuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/rag", response_model=RagSearchResponse)
def rag_search(payload: RagSearchRequest, db: Session = Depends(get_db)) -> RagSearchResponse:
    try:
        results = _semantic_search_results(payload, db)
        if not results:
            return RagSearchResponse(answer="관련 문서를 찾지 못했습니다.", citations=[])
        context = "\n\n".join(
            (
                f"[{index}] title={result.title or result.corrected_filename or 'Untitled'} "
                f"document_id={result.document_id} chunk_id={result.chunk_id}\n{result.content}"
            )
            for index, result in enumerate(results, start=1)
        )
        answer = get_text_generation_provider().complete(
            "Answer questions using only the supplied archive excerpts. If the excerpts are insufficient, say so clearly.",
            f"Question:\n{payload.query}\n\nArchive excerpts:\n{context[:12000]}\n\nAnswer in Korean and cite excerpt numbers inline like [1].",
            temperature=0.1,
            max_tokens=1024,
        )
    except AIProviderRuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return RagSearchResponse(
        answer=answer,
        citations=[
            RagCitation(
                chunk_id=result.chunk_id,
                document_id=result.document_id,
                title=result.title,
                corrected_filename=result.corrected_filename,
                content=result.content,
                score=result.score,
            )
            for result in results
        ],
    )
