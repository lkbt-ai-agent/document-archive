# PDF Upload Flow Summary

Date: 2026-06-02

## 1. Current Screen: What Happens When a PDF Is Uploaded

1. The user clicks an upload action in the current archive screen. Both the sidebar and workspace upload controls trigger the same hidden file input.

2. The file picker accepts `.jpg`, `.jpeg`, `.png`, `.webp`, `.pdf`, `.txt`, and `.md`. When a PDF is selected, `uploadFile()` sets the UI to busy, clears the current error, and calls `api.uploadDocument(selectedFolderId, file)`.

3. The frontend builds a `FormData` payload. It includes `folder_id` only when a folder is selected, and always includes the uploaded file under `file`.

4. The frontend sends `POST /api/v1/documents/upload` to the FastAPI backend.

5. The backend checks the file extension against the supported extension list. A PDF passes because `.pdf` is included.

6. The backend reads the entire uploaded file into memory, then calls `DocumentService.create_uploaded_document(...)`.

7. `DocumentService` verifies the selected folder exists when a `folder_id` was provided.

8. The original PDF bytes are saved through `StorageService`.
   - With the default/local backend, the file is written under the backend local upload directory.
   - If `STORAGE_BACKEND=minio`, the file is uploaded to MinIO.

9. A `Document` database row is created with filename, MIME type, file size, SHA-256 checksum, storage location, `source_type=uploaded`, and `processing_status=processing`.

10. Processing runs synchronously inside the upload request. There is no queue or background ingestion worker in the current implementation.

11. For PDFs, `TextExtractionService` uses `pypdf.PdfReader` and joins text extracted from each page. OCR is not used for PDFs in this path; OCR is only called for image uploads.

12. The extracted text is passed to `_index_text()`.

13. `_index_text()` calls the local text-generation provider to generate metadata: title, summary, tags, language, and document type.

14. The document title is updated from generated metadata, and a `DocumentMetadata` row is inserted.

15. The extracted text is normalized and chunked with a default size of 1200 characters and 160 characters of overlap.

16. The embedding provider embeds the chunks, and each chunk is inserted as a `DocumentChunk` row with content, token count, vector embedding, and embedding model name.

17. If all processing succeeds, the document status is set to `ready` and `processing_error` is cleared.

18. If extraction, metadata generation, or embedding fails, the status is set to `failed`, `processing_error` is saved, and the upload request returns an error.

19. On success, the backend returns the created document. The frontend refreshes the current folder document list, selects the new document, clears search results, resets the file input, and removes the busy state.

## 2. Architecture And Unimplemented Items: Executed vs Missing

The architecture describes a personal archive with folder/document management, OCR/text extraction, metadata generation, embeddings, semantic search, RAG answers, and AI-generated documents. The current PDF upload path executes only the ingestion/indexing subset.

### Actually Executed During PDF Upload

| Area | Current status |
| --- | --- |
| Next.js to FastAPI upload | Implemented. The current screen posts `FormData` to `/api/v1/documents/upload`. |
| Folder assignment | Implemented. The upload includes the selected folder id, and the backend validates it. |
| Original file storage | Implemented partially. Local storage works; MinIO upload exists when configured. |
| Document row creation | Implemented. `Document` records include size, checksum, storage key, source type, and processing status. |
| PDF text extraction | Implemented. PDFs are parsed with `pypdf`. |
| OCR routing | Partially implemented, but not for PDFs. OCR is used for image uploads only. |
| Metadata generation | Partially implemented. Title, summary, tags, language, and document type are generated. |
| Chunking | Implemented. Extracted text is split into overlapping chunks. |
| Embedding | Implemented. Chunks are embedded through the llama.cpp provider interface. |
| Search indexing | Implemented for uploaded PDF chunks once embeddings are stored. |
| Processing status | Implemented. Upload processing moves through `processing`, then `ready` or `failed`. |
| Frontend refresh after upload | Implemented. The current folder is refreshed and the uploaded document is selected. |

### Missing Or Partial Relative To `architecture.md`

| Item | Status in current code |
| --- | --- |
| Background ingestion queue | Missing. Upload processing runs synchronously inside the request path; no `apps/backend/app/jobs/` ingestion worker is present. |
| Reprocessing endpoint | Missing. `POST /documents/{document_id}/process` exists but returns `409` saying reprocessing stored objects is not implemented. |
| RAG answer API | Missing. Keyword and semantic search exist, but there is no `/search/rag` endpoint, answer generation flow, or citation response. |
| RAG answer UI | Missing. The frontend merges keyword and semantic results but does not show generated answers with citations. |
| Search filters | Partial. Current search filters by selected folder/root only; document type, tags, date range, and status filters are missing. |
| Full storage provider interface | Partial. Save to local/MinIO exists, but the documented `put_file`, `get_file`, `delete_file`, and `presigned_get_url` interface is not implemented. |
| MinIO download/read path | Missing. Download returns `501` for MinIO-backed documents. |
| PDF OCR fallback | Missing. Scanned/image-only PDFs are not routed through OCR; `pypdf` extraction may produce empty text. |
| Metadata people/organizations/key dates | Missing. DB fields exist, but the metadata prompt does not request people, organizations, or key dates. |
| Image analysis provider | Missing. OCR exists for image text extraction, but no separate image description/analysis provider is implemented. |
| Source chunk lineage | Missing/partial. Generated document lineage stores source document IDs, but `source_chunk_ids` remains empty. |
| Generated document re-indexing completeness | Partial. Generated Markdown is directly chunked and embedded, but it does not use the same extraction path or record chunk provenance. |
| Database indexes and vector index | Missing. The models define tables, but the documented relational indexes and HNSW vector index are not defined in SQLAlchemy/migrations. |
| Repository/module separation | Partial. Routers and some services exist, but several documented modules are empty or absent as concrete implementations. |
| Folder recursive archive/delete confirmation | Partial/mismatched. The frontend exposes delete confirmation and the backend deletes via ORM cascade, but the documented recursive archive-after-confirmation behavior is not implemented. |
| Folder descendant path maintenance | Missing. Updating a folder recalculates that folder's path only, not descendant paths. |
| Document content/chunks view | Missing in the current frontend. The backend exposes `/documents/{document_id}/content`, but the screen does not provide a chunk/text viewer. |
| Processing failure recovery UI | Partial. Processing errors can be displayed, but retry/reprocess controls are missing. |
| Full lineage details UI | Partial. The frontend shows action, model, and source count, but not prompt, provider name, generation params, workflow DNA, or source chunks. |

### Notes On The Existing Unimplemented Lists

- `backend_unimplemented_items.md` is broadly consistent with the current backend, especially for RAG, reprocessing, background jobs, storage read/download, metadata completeness, source chunk lineage, indexes, and module separation.
- `frontend_unimplemented_items.md` is partly stale for folder/document delete and folder rename: the current screen now exposes those controls. However, move support, recursive archive/delete behavior, RAG answer UI, reprocess controls, search filters, chunk viewing, richer lineage display, and recovery controls are still missing or partial.

## 3. Bottom Line

When a document PDF is uploaded today, the app does perform real ingestion: it stores the original PDF, extracts text with `pypdf`, generates basic metadata, chunks and embeds text, writes database rows, and refreshes the UI.

The main architectural gap is orchestration and completeness. Processing is synchronous instead of queued; PDFs do not have OCR fallback; RAG answers and citation UI are absent; filtering, reprocessing, MinIO reads, full metadata extraction, full lineage, and production-grade indexes remain unimplemented or partial.
