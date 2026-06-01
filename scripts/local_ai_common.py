"""Shared helpers for local AI scripts."""

from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "ai_providers.json"
LOCAL_ENV_PATH = ROOT / ".env.local-ai"


def load_local_env(path: Path = LOCAL_ENV_PATH) -> None:
    if not path.is_file():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def require_file(env_name: str, error_type: type[RuntimeError]) -> Path:
    value = os.environ.get(env_name)
    if not value:
        raise error_type(f"{env_name} is not set")
    path = Path(value).expanduser()
    if not path.is_file():
        raise error_type(f"{env_name} points to a missing file: {path}")
    return path


def provider_base_url(config: dict, provider: dict, error_type: type[RuntimeError]) -> str:
    provider_env = provider.get("base_url_env")
    default_env = config["default_base_url_env"]
    value = os.environ.get(provider_env or "") or os.environ.get(default_env)
    if not value:
        raise error_type(
            f"{provider_env} or {default_env} must be set for provider endpoint"
        )
    return value.rstrip("/")


def provider_model(provider: dict) -> str:
    return os.environ.get(provider["model_env"]) or provider["default_model"]


def host_port_from_base_url(base_url: str) -> tuple[str, int]:
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or not parsed.port:
        raise ValueError(f"Base URL must include scheme, host, and port: {base_url}")
    return parsed.hostname, parsed.port
