from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[4]
BACKEND_DIR = ROOT_DIR / "apps" / "backend"
BACKEND_ENV_PATH = BACKEND_DIR / ".env"
AI_PROVIDER_CONFIG_PATH = ROOT_DIR / "config" / "ai_providers.json"
LOCAL_AI_ENV_PATH = ROOT_DIR / ".env.local-ai"


def _load_key_value_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def load_local_env() -> None:
    for key, value in _load_key_value_file(BACKEND_ENV_PATH).items():
        os.environ.setdefault(key, value)
    for key, value in _load_key_value_file(LOCAL_AI_ENV_PATH).items():
        os.environ.setdefault(key, value)


@dataclass(frozen=True)
class Settings:
    database_url: str
    storage_backend: str
    local_storage_dir: Path
    minio_endpoint: str | None
    minio_access_key: str | None
    minio_secret_key: str | None
    minio_bucket: str | None
    ai_provider_config_path: Path
    embedding_dimension: int = 1024


def get_settings() -> Settings:
    load_local_env()
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured. Define it in apps/backend/.env or the environment.")

    minio_endpoint = os.environ.get("MINIO_ENDPOINT")
    minio_access_key = os.environ.get("MINIO_ACCESS_KEY")
    minio_secret_key = os.environ.get("MINIO_SECRET_KEY")
    minio_bucket = os.environ.get("MINIO_BUCKET")
    default_storage_backend = "minio" if all([minio_endpoint, minio_access_key, minio_secret_key, minio_bucket]) else "local"
    local_storage_dir = Path(
        os.environ.get("LOCAL_STORAGE_DIR", str(BACKEND_DIR / ".data" / "uploads"))
    )
    return Settings(
        database_url=database_url,
        storage_backend=os.environ.get("OBJECT_STORAGE_BACKEND", default_storage_backend).lower(),
        local_storage_dir=local_storage_dir,
        minio_endpoint=minio_endpoint,
        minio_access_key=minio_access_key,
        minio_secret_key=minio_secret_key,
        minio_bucket=minio_bucket,
        ai_provider_config_path=AI_PROVIDER_CONFIG_PATH,
        embedding_dimension=int(os.environ.get("LOCAL_AI_EMBEDDING_DIMENSION", "1024")),
    )
