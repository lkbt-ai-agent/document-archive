from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[4]
BACKEND_DIR = ROOT_DIR / "apps" / "backend"
DB_CONFIG_PATH = ROOT_DIR / "db_config.md"
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
    for key, value in _load_key_value_file(LOCAL_AI_ENV_PATH).items():
        os.environ.setdefault(key, value)


def _env_or_config(key: str, config_values: dict[str, str], default: str | None = None) -> str | None:
    return os.environ.get(key) or config_values.get(key) or default


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
    config_values = _load_key_value_file(DB_CONFIG_PATH)
    database_url = _env_or_config("DATABASE_URL", config_values)
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured. Define it in @db_config.md or the environment.")

    minio_endpoint = _env_or_config("MINIO_ENDPOINT", config_values)
    minio_access_key = _env_or_config("MINIO_ACCESS_KEY", config_values)
    minio_secret_key = _env_or_config("MINIO_SECRET_KEY", config_values)
    minio_bucket = _env_or_config("MINIO_BUCKET", config_values)
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
