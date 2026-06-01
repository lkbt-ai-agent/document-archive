# Local AI Model Setup

Phase 2.5 prepares local llama.cpp-compatible providers for the backend work in Phase 3. This phase does not implement backend business logic and does not use cloud AI APIs.

## Runtime

Use `llama-server` from llama.cpp and GGUF model files. Keep the runtime replaceable by reading all model paths, model names, and server URLs from environment variables.

Recommended Mac Mini 24GB operating mode:

- Run quantized GGUF models.
- Prefer one heavyweight model at a time.
- Use separate ports only when memory allows it.
- Avoid concurrent Qwen2.5-VL-7B-Instruct and Qwen3-14B sessions initially.
- Stop idle servers before loading another large model if memory pressure appears.

Example server commands:

```bash
# OCR/image analysis. Vision models require the model GGUF and projector GGUF.
llama-server \
  --host 127.0.0.1 \
  --port 8081 \
  -m "$LOCAL_AI_OCR_MODEL_PATH" \
  --mmproj "$LOCAL_AI_OCR_MMPROJ_PATH"

# Embeddings.
llama-server \
  --host 127.0.0.1 \
  --port 8082 \
  -m "$LOCAL_AI_EMBEDDING_MODEL_PATH" \
  --embedding

# Text generation.
llama-server \
  --host 127.0.0.1 \
  --port 8083 \
  -m "$LOCAL_AI_GENERATION_MODEL_PATH"
```

For Qwen3 verification requests, pass `chat_template_kwargs: {"enable_thinking": false}` when a normal response body is required instead of reasoning-only output.

Adjust context size, GPU layer count, batch size, and quantization based on available memory. Keep those runtime flags outside the provider config so models can be replaced later.

## Model Directory Structure

Use any local directory, but keep the role-based structure so replacement is obvious:

```text
models/
  ocr/
    qwen2.5-vl-7b-instruct.gguf
    mmproj-qwen2.5-vl-7b-instruct.gguf
  embedding/
    bge-m3.gguf
  generation/
    qwen3-14b.gguf
```

Do not hardcode these paths in source files. Export them through environment variables.

## Selected Models

| Role | Model | Use |
| --- | --- | --- |
| OCR and image analysis | `Qwen2.5-VL-7B-Instruct` | Extract text from images and describe visual document content. |
| Embeddings | `BGE-M3` | Create document chunk and query embeddings for semantic search. |
| Text generation | `Qwen3-14B` | Summarization, tagging, document generation, and document merge. |

## Environment Variables

See `.env.local-ai.example` for a copyable template.

For this machine, `.env.local-ai` can hold the actual local paths. It is intentionally ignored by git.

| Variable | Required | Purpose |
| --- | --- | --- |
| `LLAMA_CPP_BASE_URL` | Yes, unless every provider endpoint is set | Fallback llama.cpp OpenAI-compatible base URL. |
| `LLAMA_CPP_OCR_BASE_URL` | No | OCR/image analysis endpoint override. |
| `LLAMA_CPP_EMBEDDING_BASE_URL` | No | Embedding endpoint override. |
| `LLAMA_CPP_GENERATION_BASE_URL` | No | Text generation endpoint override. |
| `LOCAL_AI_OCR_MODEL_NAME` | No | OCR model name sent to the server. Defaults to `Qwen2.5-VL-7B-Instruct`. |
| `LOCAL_AI_OCR_MODEL_PATH` | Yes | Local Qwen2.5-VL GGUF path. |
| `LOCAL_AI_OCR_MMPROJ_PATH` | Yes | Local Qwen2.5-VL projector GGUF path. |
| `LOCAL_AI_EMBEDDING_MODEL_NAME` | No | Embedding model name sent to the server. Defaults to `BGE-M3`. |
| `LOCAL_AI_EMBEDDING_MODEL_PATH` | Yes | Local BGE-M3 GGUF path. |
| `LOCAL_AI_GENERATION_MODEL_NAME` | No | Generation model name sent to the server. Defaults to `Qwen3-14B`. |
| `LOCAL_AI_GENERATION_MODEL_PATH` | Yes | Local Qwen3-14B GGUF path. |

## Provider Configuration

The provider map is stored in `config/ai_providers.json`. Phase 3 backend code should consume this same file and resolve:

- provider role: `ocr`, `embedding`, `generation`
- OpenAI-compatible endpoint path
- model name environment variable
- model path environment variable
- provider-specific base URL with fallback to `LLAMA_CPP_BASE_URL`

If a model file, projector file, or endpoint is missing, provider startup and verification must fail with a clear error instead of returning mock responses.

## Health Check

Run:

```bash
python3 scripts/local_ai_health_check.py
```

The health check validates configured model files and calls each configured llama.cpp server health endpoint.

## Start Servers

The local scripts automatically load `.env.local-ai` when it exists.

```bash
python3 scripts/start_local_ai_provider.py ocr
python3 scripts/start_local_ai_provider.py embedding
python3 scripts/start_local_ai_provider.py generation
```

On a Mac Mini 24GB, run only the providers needed for the current task if memory pressure appears.

## Verification

Run:

```bash
python3 scripts/verify_local_ai.py --image /absolute/path/to/sample-image.png
```

The verification script sends:

- an OCR/image request to `/v1/chat/completions`
- an embedding request to `/v1/embeddings`
- a text generation request to `/v1/chat/completions`

These calls must reach real local llama.cpp servers. No mock AI responses are implemented in Phase 2.5.

Actual backend integration will be implemented in Phase 3.
