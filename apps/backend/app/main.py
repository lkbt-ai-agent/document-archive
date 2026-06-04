from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import load_local_env
from app.core.database import init_db


load_local_env()


def _cors_origins() -> list[str]:
    configured = os.environ.get("BACKEND_CORS_ORIGINS", "")
    origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
    origins.extend(origin.strip() for origin in configured.split(",") if origin.strip())
    return list(dict.fromkeys(origins))


app = FastAPI(title="Document Archive Backend", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_origin_regex=r"^https?://[a-zA-Z0-9-]+\.tail[a-zA-Z0-9]+\.ts\.net(?::3000)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
