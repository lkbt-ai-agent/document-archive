# Storage and Infrastructure

Connection/config values live in `@db_config.md`.

## PostgreSQL + pgvector

PostgreSQL stores folders, documents, metadata, chunks, lineage, and vectors. pgvector handles semantic search inside PostgreSQL; do not add a separate vector DB.

Use `DocumentChunk.embedding vector(n)`, where `n` matches BGE-M3 output.

Search flow:

1. Embed query.
2. Query `document_chunks` by vector distance.
3. Join documents/folders/metadata for filters and display.
4. Pass top chunks to generation for RAG when needed.

Start with exact search. Add HNSW when latency requires it:

```sql
CREATE INDEX document_chunks_embedding_hnsw_idx
ON document_chunks
USING hnsw (embedding vector_cosine_ops);
```

## MinIO

Use MinIO for original uploads, generated files, and previews once files should survive backend restarts or exceed local-dev prototype needs.

Object layout:

```text
documents/
  originals/{document_id}/{safe_original_filename}
  generated/{document_id}/{filename}
  previews/{document_id}/{page_or_preview_key}
```

Do not expose MinIO credentials to the frontend. Serve files through backend endpoints or short-lived presigned URLs.

## Storage Provider

```python
class StorageProvider(Protocol):
    async def put_file(self, *, object_key: str, data: BinaryIO, content_type: str) -> StoredObject: ...
    async def get_file(self, *, object_key: str) -> BinaryIO: ...
    async def delete_file(self, *, object_key: str) -> None: ...
    async def presigned_get_url(self, *, object_key: str, expires_seconds: int) -> str: ...
```

## Runtime Layout

```text
Next.js UI
  -> FastAPI
  -> PostgreSQL + pgvector
  -> MinIO

FastAPI
  -> AI provider interfaces
  -> llama.cpp local model processes
```

## Official Docs Checked With Context7

- FastAPI: `APIRouter`, `include_router`, `Depends`, Pydantic validation, background tasks.
- pgvector: vector types, cosine/L2/inner-product operators, HNSW/IVFFlat indexes.
- MinIO: S3-compatible buckets/objects, Python SDK, presigned upload/download URLs.
