from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.llama_cpp_provider import get_embedding_provider
from app.ai.providers import AIProviderRuntimeError
from app.api.v1.schemas import KeywordSearchRequest, SearchResult, SemanticSearchRequest
from app.core.database import get_db
from app.db.models import Document, DocumentChunk, ProcessingStatus


router = APIRouter(prefix="/search", tags=["search"])


@router.post("/keyword", response_model=list[SearchResult])
def keyword_search(payload: KeywordSearchRequest, db: Session = Depends(get_db)) -> list[SearchResult]:
    stmt = (
        select(DocumentChunk, Document)
        .join(Document, Document.id == DocumentChunk.document_id)
        .where(Document.processing_status == ProcessingStatus.ready)
        .where(DocumentChunk.content.ilike(f"%{payload.query}%"))
        .limit(payload.limit)
    )
    if payload.root_only:
        stmt = stmt.where(Document.folder_id.is_(None))
    elif payload.folder_id:
        stmt = stmt.where(Document.folder_id == payload.folder_id)
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
        vector = get_embedding_provider().embed([payload.query])[0]
    except AIProviderRuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
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
