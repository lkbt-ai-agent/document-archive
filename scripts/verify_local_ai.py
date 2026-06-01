#!/usr/bin/env python3
"""Send minimal real requests to local llama.cpp providers."""

from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import sys
import urllib.error
import urllib.request
from pathlib import Path

from local_ai_common import (
    CONFIG_PATH,
    load_local_env,
    provider_base_url,
    provider_model,
    require_file,
)

TIMEOUT_SECONDS = 120


class VerificationError(RuntimeError):
    pass


def load_config() -> dict:
    with CONFIG_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def post_json(base_url: str, endpoint: str, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url}{endpoint}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            body = response.read().decode("utf-8")
            if response.status >= 400:
                raise VerificationError(
                    f"{base_url}{endpoint} returned HTTP {response.status}: {body}"
                )
            return json.loads(body)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise VerificationError(
            f"{base_url}{endpoint} returned HTTP {exc.code}: {body}"
        ) from exc
    except urllib.error.URLError as exc:
        raise VerificationError(
            f"{base_url}{endpoint} is not reachable: {exc.reason}"
        ) from exc
    except json.JSONDecodeError as exc:
        raise VerificationError(f"{base_url}{endpoint} returned invalid JSON") from exc


def verify_model_files(config: dict) -> None:
    for provider in config["providers"].values():
        require_file(provider["model_path_env"], VerificationError)
        if "mmproj_path_env" in provider:
            require_file(provider["mmproj_path_env"], VerificationError)


def verify_ocr(config: dict, image_path: Path) -> None:
    provider = config["providers"]["ocr"]
    base_url = provider_base_url(config, provider, VerificationError)
    mime_type = mimetypes.guess_type(image_path.name)[0] or "image/png"
    image_bytes = image_path.read_bytes()
    image_data = base64.b64encode(image_bytes).decode("ascii")
    payload = {
        "model": provider_model(provider),
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Extract visible text from this image. Return only the text.",
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{image_data}"
                        },
                    },
                ],
            }
        ],
        "max_tokens": 256,
        "temperature": 0,
    }
    result = post_json(base_url, provider["endpoint"], payload)
    content = result.get("choices", [{}])[0].get("message", {}).get("content")
    if not content:
        raise VerificationError("OCR request completed but returned no text content")
    print(f"OK ocr: {content[:160].replace(chr(10), ' ')}")


def verify_embedding(config: dict) -> None:
    provider = config["providers"]["embedding"]
    base_url = provider_base_url(config, provider, VerificationError)
    payload = {
        "model": provider_model(provider),
        "input": ["Local document archive semantic search verification."],
    }
    result = post_json(base_url, provider["endpoint"], payload)
    embedding = result.get("data", [{}])[0].get("embedding")
    if not isinstance(embedding, list) or not embedding:
        raise VerificationError("Embedding request completed but returned no vector")
    print(f"OK embedding: dimensions={len(embedding)}")


def verify_generation(config: dict) -> None:
    provider = config["providers"]["generation"]
    base_url = provider_base_url(config, provider, VerificationError)
    payload = {
        "model": provider_model(provider),
        "messages": [
            {
                "role": "user",
                "content": "Reply with one short sentence confirming local text generation.",
            }
        ],
        "chat_template_kwargs": {"enable_thinking": False},
        "max_tokens": 80,
        "temperature": 0,
    }
    result = post_json(base_url, provider["endpoint"], payload)
    content = result.get("choices", [{}])[0].get("message", {}).get("content")
    if not content:
        raise VerificationError("Generation request completed but returned no content")
    print(f"OK generation: {content[:160].replace(chr(10), ' ')}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--image",
        required=True,
        help="Path to an image used for the OCR/image analysis verification request.",
    )
    return parser.parse_args()


def main() -> int:
    load_local_env()
    args = parse_args()
    image_path = Path(args.image).expanduser()
    if not image_path.is_file():
        print(f"Image file does not exist: {image_path}", file=sys.stderr)
        return 1

    try:
        config = load_config()
        verify_model_files(config)
        verify_ocr(config, image_path)
        verify_embedding(config)
        verify_generation(config)
    except VerificationError as exc:
        print(f"Local AI verification failed: {exc}", file=sys.stderr)
        return 1

    print("Local AI verification passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
