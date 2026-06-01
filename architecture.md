# Architecture Index

Personal document archive with folder/document management, OCR/text extraction, metadata generation, embeddings, semantic search, RAG answers, and AI-generated documents.

## Stack

- Frontend: Next.js in `apps/frontend/`.
- Backend: Python FastAPI in `apps/backend/`.
- DB: PostgreSQL + pgvector.
- Object storage: MinIO when files should not live on the API filesystem.
- Local AI runtime: llama.cpp behind provider interfaces.

Use FastAPI over NestJS. The backend is Python-heavy: file parsing, OCR, embeddings, llama.cpp integration, and AI pipelines.

## Topic Files

- [Backend and API](docs/backend_api.md): folder structure, modules, endpoints.
- [Data Model](docs/data_model.md): entities, fields, indexes.
- [AI and RAG](docs/ai_rag.md): provider interfaces, local models, pipelines.
- [Storage and Infrastructure](docs/storage_infra.md): PostgreSQL/pgvector, MinIO, Mac Mini limits, docs references.

## Config

Database and MinIO connection details are defined in `@db_config.md`.

## Non-Goals

- No Kubernetes.
- No separate vector DB.
- No microservices.
- No event bus at the start.
- No workflow engine.
