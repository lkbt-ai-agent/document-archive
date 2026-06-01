# Data Model

Primary database: PostgreSQL. Vector search: pgvector in the same DB. Config lives in `@db_config.md`.

## Folder

```text
id: UUID primary key
parent_id: UUID nullable self-reference
name: string
path: string nullable
created_at: timestamp
updated_at: timestamp
```

Use `parent_id` for nesting. Add/maintain `path` only if tree reads need it.

## Document

```text
id: UUID primary key
folder_id: UUID foreign key -> Folder.id
title: string nullable
original_filename: string
mime_type: string
file_size: bigint
checksum_sha256: string
storage_bucket: string nullable
storage_object_key: string
is_generated: boolean
source_type: enum(uploaded, generated)
processing_status: enum(pending, processing, ready, failed)
processing_error: text nullable
created_at: timestamp
updated_at: timestamp
```

Generated files are `Document` rows with `is_generated = true`.

## DocumentMetadata

```text
id: UUID primary key
document_id: UUID unique foreign key -> Document.id
summary: text nullable
tags: text[] or jsonb
language: string nullable
document_type: string nullable
people: jsonb
organizations: jsonb
key_dates: jsonb
model_name: string
model_version: string nullable
generated_at: timestamp
```

Use `jsonb` for flexible AI fields. Keep common filters as columns.

## DocumentChunk

```text
id: UUID primary key
document_id: UUID foreign key -> Document.id
chunk_index: integer
page_start: integer nullable
page_end: integer nullable
content: text
token_count: integer nullable
embedding: vector(<BGE-M3 dimension>)
embedding_model: string
embedding_version: string nullable
created_at: timestamp
```

Embedding dimension must match the chosen BGE-M3 output. Store chunk text with vectors for fast result rendering.

## GeneratedDocumentLineage

```text
id: UUID primary key
generated_document_id: UUID foreign key -> Document.id
source_document_ids: UUID[] or jsonb
source_chunk_ids: UUID[] or jsonb
operation: enum(summary, rewrite, merge, generated_from_prompt)
prompt: text
model_name: string
provider_name: string
generation_params: jsonb
created_at: timestamp
```

Arrays/jsonb are enough initially. Add source join tables only if lineage queries become complex.

## Indexes

- `folders(parent_id)`
- `documents(folder_id)`
- `documents(processing_status)`
- `documents(created_at)`
- `document_chunks(document_id, chunk_index)`
- `document_metadata(document_id)`
- `document_chunks.embedding` HNSW when chunk count grows

## Vector Query Shape

```sql
SELECT
  dc.id,
  dc.document_id,
  dc.content,
  d.title,
  dc.embedding <=> :query_embedding AS distance
FROM document_chunks dc
JOIN documents d ON d.id = dc.document_id
WHERE d.processing_status = 'ready'
ORDER BY dc.embedding <=> :query_embedding
LIMIT :limit;
```

Use cosine distance for normalized text embeddings unless evaluation says otherwise.
