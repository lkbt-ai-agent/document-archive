# Document Archive

Local document archive project with a Next.js frontend, FastAPI backend, and optional local llama.cpp AI providers.

## Frontend

Run from the frontend app directory:

```bash
cd apps/frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

The frontend calls the backend at `http://127.0.0.1:8000` by default. Override it with:

```bash
NEXT_PUBLIC_BACKEND_API_URL=http://127.0.0.1:8000 npm run dev
```

## Backend

Run from the backend app directory:

```bash
cd apps/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs are available at `http://127.0.0.1:8000/docs`.

Database and object storage values are read from `db_config.md` or environment variables. Local AI settings are read from `.env.local-ai` when present.

## llama.cpp Models

The local AI startup scripts load `.env.local-ai` automatically. Use `.env.local-ai.example` as the template and set the llama.cpp server binary plus model paths before starting providers.

Required local AI variables include:

```bash
LLAMA_CPP_SERVER_BIN=/absolute/path/to/llama-server
LLAMA_CPP_OCR_BASE_URL=http://127.0.0.1:8081
LLAMA_CPP_EMBEDDING_BASE_URL=http://127.0.0.1:8082
LLAMA_CPP_GENERATION_BASE_URL=http://127.0.0.1:8083
LOCAL_AI_OCR_MODEL_PATH=/absolute/path/to/ocr-model.gguf
LOCAL_AI_OCR_MMPROJ_PATH=/absolute/path/to/ocr-mmproj.gguf
LOCAL_AI_EMBEDDING_MODEL_PATH=/absolute/path/to/embedding-model.gguf
LOCAL_AI_GENERATION_MODEL_PATH=/absolute/path/to/generation-model.gguf
```

Start each provider from the project root:

```bash
python3 scripts/start_local_ai_provider.py ocr
python3 scripts/start_local_ai_provider.py embedding
python3 scripts/start_local_ai_provider.py generation
```

Provider roles:

| Role | Default port | Purpose |
| --- | --- | --- |
| `ocr` | `8081` | OCR and image analysis |
| `embedding` | `8082` | Embeddings and semantic search |
| `generation` | `8083` | Summarization, tagging, document generation, and merge |

Print a provider command without starting it:

```bash
python3 scripts/start_local_ai_provider.py generation --print-only
```

Check local AI configuration and server health:

```bash
python3 scripts/local_ai_health_check.py
```

Run an end-to-end local AI verification:

```bash
python3 scripts/verify_local_ai.py --image /absolute/path/to/sample-image.png
```

On memory-constrained machines, start only the llama.cpp providers needed for the current task.

## Typical Local Startup

Use separate terminal sessions:

```bash
# Terminal 1: backend
cd apps/backend
. .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

```bash
# Terminal 2: frontend
cd apps/frontend
npm run dev
```

```bash
# Terminal 3: optional generation model
python3 scripts/start_local_ai_provider.py generation
```
