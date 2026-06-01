#!/usr/bin/env python3
"""Validate local llama.cpp provider configuration and server health."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

from local_ai_common import CONFIG_PATH, load_local_env, provider_base_url, require_file

TIMEOUT_SECONDS = 5


class ConfigError(RuntimeError):
    pass


def load_config() -> dict:
    with CONFIG_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def check_http_health(base_url: str) -> None:
    health_url = f"{base_url}/health"
    request = urllib.request.Request(health_url, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            if response.status >= 400:
                raise ConfigError(f"{health_url} returned HTTP {response.status}")
    except urllib.error.HTTPError as exc:
        raise ConfigError(f"{health_url} returned HTTP {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise ConfigError(f"{health_url} is not reachable: {exc.reason}") from exc


def main() -> int:
    load_local_env()
    config = load_config()
    failures: list[str] = []

    for role, provider in config["providers"].items():
        try:
            require_file(provider["model_path_env"], ConfigError)
            if "mmproj_path_env" in provider:
                require_file(provider["mmproj_path_env"], ConfigError)
            base_url = provider_base_url(config, provider, ConfigError)
            check_http_health(base_url)
            print(f"OK {role}: {base_url}")
        except ConfigError as exc:
            failures.append(f"{role}: {exc}")

    if failures:
        print("Local AI health check failed:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1

    print("Local AI health check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
