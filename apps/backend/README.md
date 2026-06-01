# Document Archive Backend

FastAPI backend for Phase 3.

Database, pgvector, and optional MinIO connection values are defined in `../../db_config.md`. Runtime environment variables can override those values.

```bash
cd apps/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs are available at `http://127.0.0.1:8000/docs`.

Local AI providers use the Phase 2.5 llama.cpp config in `../../config/ai_providers.json` and `.env.local-ai`.
