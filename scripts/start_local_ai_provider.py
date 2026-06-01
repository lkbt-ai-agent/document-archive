#!/usr/bin/env python3
"""Start one configured llama.cpp provider server."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

from local_ai_common import (
    CONFIG_PATH,
    host_port_from_base_url,
    load_local_env,
    provider_base_url,
    provider_model,
    require_file,
)


class StartError(RuntimeError):
    pass


def load_config() -> dict:
    with CONFIG_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def build_command(config: dict, role: str) -> list[str]:
    provider = config["providers"][role]
    server_bin = require_file("LLAMA_CPP_SERVER_BIN", StartError)
    model_path = require_file(provider["model_path_env"], StartError)
    model_name = provider_model(provider)
    base_url = provider_base_url(config, provider, StartError)

    try:
        host, port = host_port_from_base_url(base_url)
    except ValueError as exc:
        raise StartError(str(exc)) from exc

    command = [
        str(server_bin),
        "--host",
        host,
        "--port",
        str(port),
        "-m",
        str(model_path),
        "--alias",
        model_name,
        "--ctx-size",
        os.environ.get(f"LOCAL_AI_{role.upper()}_CTX_SIZE", "4096"),
    ]

    if role == "ocr":
        mmproj_path = require_file(provider["mmproj_path_env"], StartError)
        command.extend(["--mmproj", str(mmproj_path)])
    elif role == "embedding":
        command.append("--embedding")
        pooling = os.environ.get("LOCAL_AI_EMBEDDING_POOLING")
        if pooling:
            command.extend(["--pooling", pooling])

    return command


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("role", choices=["ocr", "embedding", "generation"])
    parser.add_argument(
        "--print-only",
        action="store_true",
        help="Print the llama-server command without starting it.",
    )
    return parser.parse_args()


def main() -> int:
    load_local_env()
    args = parse_args()

    try:
        command = build_command(load_config(), args.role)
    except StartError as exc:
        print(f"Cannot start local AI provider: {exc}", file=sys.stderr)
        return 1

    print(" ".join(command))
    if args.print_only:
        return 0

    return subprocess.call(command)


if __name__ == "__main__":
    raise SystemExit(main())
