# Backend Unimplemented Items

Based on `architecture.md` and its referenced documents.

## 1. RAG Answer API

**Description:** `docs/backend_api.md` defines `POST /search/rag` for semantic search plus generated answers with citations. The backend currently implements keyword search and semantic search only; there is no RAG endpoint, citation response schema, or generation flow that builds an answer from retrieved chunks.

**Priority:** High

## 2. Document Reprocessing Job

**Description:** `docs/backend_api.md` defines `POST /documents/{document_id}/process` to enqueue or rerun extraction, metadata generation, and embedding. The current endpoint returns a `409` saying reprocessing stored objects is not implemented.

**Priority:** High

## 3. Background Ingestion Queue

**Description:** `docs/backend_api.md` and `docs/ai_rag.md` specify background jobs for long processing and Mac Mini 24GB limits recommend queued OCR, embedding, and generation calls. Upload processing currently runs synchronously inside the request path, and `apps/backend/app/jobs/` is not implemented.

**Priority:** High

## 4. RAG/Search Filters

**Description:** `docs/ai_rag.md` requires filters by folder, document type, tags, date range, and status. Current keyword and semantic search support folder filtering only.

**Priority:** Medium

## 5. Full Storage Provider Interface

**Description:** `docs/storage_infra.md` defines a replaceable `StorageProvider` with `put_file`, `get_file`, `delete_file`, and `presigned_get_url`. The current storage module supports saving local files or MinIO objects, but does not expose the documented provider interface or read/delete/presigned operations.

**Priority:** Medium

## 6. MinIO Download/Read Path

**Description:** `docs/storage_infra.md` requires serving files through backend endpoints or short-lived presigned URLs without exposing MinIO credentials. The current download endpoint returns `501` for MinIO-backed documents.

**Priority:** Medium

## 7. Recursive Folder Archive/Delete Confirmation

**Description:** `docs/backend_api.md` says folder delete should delete if empty or archive recursively after confirmation. The current implementation only rejects non-empty folders with `409` and does not implement recursive archive/delete confirmation.

**Priority:** Medium

## 8. Folder Path Maintenance For Descendants

**Description:** `docs/data_model.md` allows `path` for tree reads. The current folder update recalculates the changed folder path but does not update descendant folder paths after rename or move.

**Priority:** Medium

## 9. Metadata People, Organizations, And Key Dates Extraction

**Description:** `docs/data_model.md` includes `people`, `organizations`, and `key_dates` on `DocumentMetadata`, and `docs/backend_api.md` lists metadata responsibilities for dates, people, and organizations. The database columns exist, but the metadata prompt only asks for title, summary, tags, language, and document type.

**Priority:** Medium

## 10. Image Analysis Provider

**Description:** `docs/ai_rag.md` defines both OCR and image analysis provider capabilities. The current provider layer implements OCR text extraction from images, but not a separate image description or analysis provider method.

**Priority:** Low

## 11. Source Chunk Lineage

**Description:** `docs/data_model.md` includes `source_chunk_ids` for generated document lineage. The column exists, but generation currently records source document IDs only and leaves source chunk IDs empty.

**Priority:** Low

## 12. Generated Document Re-indexing Completeness

**Description:** `docs/ai_rag.md` says generated documents should be extracted, chunked, and embedded if searchable. The current implementation indexes generated Markdown content directly, which covers search, but does not run the same extraction path or record source chunk provenance.

**Priority:** Low

## 13. Database Indexes And Vector Index

**Description:** `docs/data_model.md` specifies indexes for folders, documents, chunks, metadata, and an HNSW vector index when chunk count grows. The current SQLAlchemy model creates tables but does not define these indexes.

**Priority:** Low

## 14. Repository Layer And Module Separation

**Description:** `docs/backend_api.md` describes repositories and modules for folders, metadata, embeddings, search, generation, lineage, and jobs. The current backend has thin routers and some services, but several documented modules are empty or absent as concrete implementations.

**Priority:** Low
