# Backend and API

## Backend Choice

Use Python FastAPI. Keep routers thin; place behavior in modules. Use FastAPI `APIRouter`, dependency injection, Pydantic schemas, and background jobs for long processing.

## Folder Structure

```text
apps/backend/
  app/
    main.py
    core/
      config.py
      database.py
      logging.py
    api/v1/
      router.py
      folders.py
      documents.py
      search.py
      generation.py
    modules/
      folders/
      documents/
      storage/
      extraction/
      metadata/
      embeddings/
      search/
      generation/
      lineage/
    ai/
      providers.py
      llama_cpp_provider.py
      schemas.py
    db/
      models.py
      repositories/
      migrations/
    jobs/
      ingestion.py
      generation.py
  tests/
```

## Modules

| Module | Responsibility | Main Entity |
| --- | --- | --- |
| folders | Create, rename, move, delete, list tree | `Folder` |
| documents | Upload/list/detail/delete, processing state | `Document` |
| storage | Save/read/delete files through local or MinIO backend | `Document` |
| extraction | PDF/office/text/image extraction, OCR routing | `DocumentChunk` |
| metadata | Summary, tags, language, type, dates, people, orgs | `DocumentMetadata` |
| embeddings | Chunk text, embed chunks, re-embed by model version | `DocumentChunk` |
| search | Query embedding, pgvector search, filters, RAG context | `DocumentChunk` |
| generation | Summarize, rewrite, merge, generate documents | `Document` |
| lineage | Track generated document sources and params | `GeneratedDocumentLineage` |

## API Prefix

All backend routes use `/api/v1`.

## Folder API

- `GET /folders`: folder tree.
- `POST /folders`: create.
- `PATCH /folders/{folder_id}`: rename or move.
- `DELETE /folders/{folder_id}`: delete if empty or archive recursively after confirmation.

## Document API

- `POST /documents/upload`: upload into folder.
- `GET /documents`: list with filters.
- `GET /documents/{document_id}`: detail.
- `GET /documents/{document_id}/content`: extracted text/chunks.
- `POST /documents/{document_id}/process`: enqueue or rerun extraction, metadata, embedding.
- `DELETE /documents/{document_id}`: delete/archive.

## Search API

- `POST /search/semantic`: semantic chunk/document search.
- `POST /search/rag`: semantic search plus generated answer with citations.

## Generation API

- `POST /generation/documents`: generate from prompt and source documents.
- `POST /generation/merge`: merge source documents.
- `GET /generation/{generated_document_id}/lineage`: inspect lineage.
