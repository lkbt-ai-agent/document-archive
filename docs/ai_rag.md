# AI and RAG

All model calls go through provider interfaces. llama.cpp is the first runtime, not a hard dependency of domain modules.

Phase 2.5 local runtime setup, environment variables, provider config, and verification scripts are documented in [Local AI Model Setup](local_ai_models.md). Backend integration remains a Phase 3 task.

## Local Model Map

| Use | Model |
| --- | --- |
| OCR/image analysis | `Qwen2.5-VL-7B-Instruct` |
| Embeddings | `BGE-M3` |
| Metadata | `Qwen3-14B` |
| Summaries | `Qwen3-14B` |
| Document generation | `Qwen3-14B` |
| Document merge | `Qwen3-14B` |

## Provider Interfaces

```python
class OcrProvider(Protocol):
    async def extract_text_from_image(self, *, image_bytes: bytes, mime_type: str) -> OcrResult: ...

class ImageAnalysisProvider(Protocol):
    async def describe_image(self, *, image_bytes: bytes, mime_type: str) -> ImageAnalysisResult: ...

class EmbeddingProvider(Protocol):
    async def embed_texts(self, texts: list[str]) -> list[list[float]]: ...
    async def embed_query(self, query: str) -> list[float]: ...

class MetadataProvider(Protocol):
    async def generate_metadata(self, *, text: str) -> DocumentMetadataDraft: ...

class GenerationProvider(Protocol):
    async def summarize(self, *, chunks: list[str], instructions: str | None = None) -> str: ...
    async def generate_document(self, *, prompt: str, context_chunks: list[str]) -> GeneratedDocumentDraft: ...
    async def merge_documents(self, *, source_texts: list[str], instructions: str | None = None) -> GeneratedDocumentDraft: ...
```

Record `provider_name`, `model_name`, version, and params on metadata/lineage rows.

## Ingestion Pipeline

```text
upload
  -> store original
  -> Document(status=pending)
  -> extract text
  -> OCR/image analysis when needed
  -> chunk text
  -> embed chunks
  -> generate metadata
  -> Document(status=ready)
```

On failure: keep file, set `processing_status = failed`, save `processing_error`.

## Semantic Search/RAG

```text
query
  -> embed query
  -> pgvector nearest-neighbor search
  -> apply SQL filters
  -> return chunks/documents
  -> optional answer generation with citations
```

Filters: folder, document type, tags, date range, status.

## Generated Documents

```text
prompt + source documents
  -> fetch source chunks
  -> generate/merge with Qwen3-14B
  -> store generated output
  -> create Document(is_generated=true)
  -> create GeneratedDocumentLineage
  -> extract/chunk/embed generated document if searchable
```

## Mac Mini 24GB Rules

- Use quantized GGUF models.
- Prefer one heavyweight model call at a time.
- Queue OCR, embedding, and generation jobs.
- Unload idle models if memory pressure appears.
- Avoid concurrent Qwen2.5-VL and Qwen3-14B sessions initially.
