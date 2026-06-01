# Frontend Unimplemented Items

Based on `architecture.md` and its referenced documents, with frontend-facing gaps inferred from the documented backend/API capabilities.

## 1. RAG Answer UI

**Description:** `architecture.md` includes RAG answers, and `docs/backend_api.md` defines `POST /search/rag`. The frontend currently combines keyword and semantic search results, but does not provide a RAG answer view with citations.

**Priority:** High

## 2. Document Reprocess Control

**Description:** `docs/backend_api.md` defines `POST /documents/{document_id}/process` for rerunning extraction, metadata generation, and embedding. The frontend does not expose a reprocess action or status flow for this API.

**Priority:** Medium

## 3. Folder Rename, Move, And Delete UI

**Description:** `docs/backend_api.md` includes folder create, rename/move, and delete. The frontend currently supports folder creation and navigation, but not renaming, moving, deleting, or handling recursive delete confirmation.

**Priority:** Medium

## 4. Document Delete UI

**Description:** `docs/backend_api.md` includes `DELETE /documents/{document_id}`. The frontend does not expose document deletion or archive behavior.

**Priority:** Medium

## 5. Search Filters UI

**Description:** `docs/ai_rag.md` requires filters for folder, document type, tags, date range, and status. The frontend search uses the selected folder only and does not provide controls for the other documented filters.

**Priority:** Medium

## 6. Document Content/Chunks View

**Description:** `docs/backend_api.md` defines `GET /documents/{document_id}/content` for extracted text and chunks. The frontend shows metadata but does not provide a view for extracted text or chunk content.

**Priority:** Medium

## 7. Full Lineage Details

**Description:** `docs/data_model.md` defines generated document lineage with source documents, source chunks, prompt, model, provider, generation params, and workflow DNA metadata. The frontend currently shows only action, model, and source count.

**Priority:** Medium

## 8. Processing Failure Recovery UI

**Description:** `docs/ai_rag.md` requires failed processing status and error preservation. The frontend displays processing errors, but does not provide retry/reprocess or guided recovery controls.

**Priority:** Low

## 9. MinIO/Presigned File Handling UX

**Description:** `docs/storage_infra.md` allows MinIO-backed files served through backend endpoints or presigned URLs. The frontend currently opens the backend download URL, but has no specific handling for pending/unavailable MinIO download support.

**Priority:** Low

## 10. Generated Document Prompt And Workflow DNA Display

**Description:** `docs/ai_rag.md` and `docs/data_model.md` require generated documents to store generation prompt and workflow DNA metadata. The frontend does not display the original prompt, generation params, provider name, or workflow DNA details.

**Priority:** Low
