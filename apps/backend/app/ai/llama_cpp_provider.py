from __future__ import annotations

import base64
import json
import os
from pathlib import Path
from typing import Any

import httpx

from app.ai.providers import AIProviderRuntimeError, EmbeddingProvider, GeneratedMetadata, OCRProvider, TextGenerationProvider
from app.core.config import get_settings

METADATA_TEXT_CHAR_LIMIT = 3500
DEFAULT_EMBEDDING_REQUEST_BATCH_SIZE = 1


def _json_list(payload: dict[str, Any], key: str, limit: int) -> list[str]:
    value = payload.get(key, [])
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()][:limit]


def _load_provider_config() -> dict[str, Any]:
    path = get_settings().ai_provider_config_path
    if not path.exists():
        raise AIProviderRuntimeError(f"AI provider config is missing: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


class _LlamaProviderBase:
    role: str

    def __init__(self, role: str) -> None:
        config = _load_provider_config()
        provider = config["providers"][role]
        base_url = os.environ.get(provider["base_url_env"]) or os.environ.get(config["default_base_url_env"])
        if not base_url:
            raise AIProviderRuntimeError(
                f"{provider['base_url_env']} or {config['default_base_url_env']} must be configured for {role} provider."
            )
        self.role = role
        self.endpoint = provider["endpoint"]
        self.base_url = base_url.rstrip("/")
        self.model_name = os.environ.get(provider["model_env"], provider["default_model"])
        self.provider_config = provider
        self._validate_model_files()

    def _validate_model_files(self) -> None:
        model_path_env = self.provider_config.get("model_path_env")
        if model_path_env:
            model_path = os.environ.get(model_path_env)
            if not model_path:
                raise AIProviderRuntimeError(f"{model_path_env} is required for {self.role} provider.")
            if not Path(model_path).exists():
                raise AIProviderRuntimeError(f"{self.role} model file does not exist: {model_path}")
        mmproj_path_env = self.provider_config.get("mmproj_path_env")
        if mmproj_path_env:
            mmproj_path = os.environ.get(mmproj_path_env)
            if not mmproj_path:
                raise AIProviderRuntimeError(f"{mmproj_path_env} is required for {self.role} provider.")
            if not Path(mmproj_path).exists():
                raise AIProviderRuntimeError(f"{self.role} projector file does not exist: {mmproj_path}")

    def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.base_url}{self.endpoint}"
        try:
            with httpx.Client(timeout=180) as client:
                response = client.post(url, json=payload)
                if response.is_error:
                    detail = response.text[:500].strip()
                    response.raise_for_status()
                return response.json()
        except httpx.HTTPError as exc:
            suffix = f" Response body: {detail}" if "detail" in locals() and detail else ""
            raise AIProviderRuntimeError(f"{self.role} provider request failed at {url}: {exc}{suffix}") from exc


class LlamaCppOCRProvider(_LlamaProviderBase, OCRProvider):
    def __init__(self) -> None:
        super().__init__("ocr")

    def extract_text(self, image_bytes: bytes, mime_type: str) -> str:
        encoded = base64.b64encode(image_bytes).decode("ascii")
        payload = {
            "model": self.model_name,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Extract all readable text from this document image. Return only the extracted text."},
                        {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{encoded}"}},
                    ],
                }
            ],
            "temperature": 0,
        }
        data = self._post(payload)
        return data["choices"][0]["message"]["content"].strip()


class LlamaCppEmbeddingProvider(_LlamaProviderBase, EmbeddingProvider):
    def __init__(self) -> None:
        super().__init__("embedding")
        self.request_batch_size = self._request_batch_size()

    def _request_batch_size(self) -> int:
        raw_value = os.environ.get("LOCAL_AI_EMBEDDING_REQUEST_BATCH_SIZE")
        if raw_value is None:
            return DEFAULT_EMBEDDING_REQUEST_BATCH_SIZE
        try:
            value = int(raw_value)
        except ValueError as exc:
            raise AIProviderRuntimeError("LOCAL_AI_EMBEDDING_REQUEST_BATCH_SIZE must be an integer.") from exc
        if value <= 0:
            raise AIProviderRuntimeError("LOCAL_AI_EMBEDDING_REQUEST_BATCH_SIZE must be greater than zero.")
        return value

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        embeddings: list[list[float]] = []
        for start in range(0, len(texts), self.request_batch_size):
            batch = texts[start : start + self.request_batch_size]
            data = self._post({"model": self.model_name, "input": batch})
            embeddings.extend(item["embedding"] for item in data["data"])
        return embeddings


class LlamaCppTextGenerationProvider(_LlamaProviderBase, TextGenerationProvider):
    def __init__(self) -> None:
        super().__init__("generation")

    def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        max_tokens: int | None = None,
    ) -> str:
        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "chat_template_kwargs": {"enable_thinking": False},
        }
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
        data = self._post(payload)
        return data["choices"][0]["message"]["content"].strip()

    def generate_metadata(self, text: str) -> GeneratedMetadata:
        system = "You produce compact JSON metadata for archived documents."
        user = (
            "Create metadata for this document. Return JSON only with keys: "
            "title, summary, tags, language, document_type, people, organizations, key_dates. "
            "Use arrays for tags, people, organizations, and key_dates. "
            "Use ISO dates when possible, otherwise keep the date text as written. "
            f"Document text:\n{text[:METADATA_TEXT_CHAR_LIMIT]}"
        )
        raw = self.complete(system, user, temperature=0.1, max_tokens=768)
        try:
            payload = json.loads(raw.strip().removeprefix("```json").removesuffix("```").strip())
        except json.JSONDecodeError as exc:
            raise AIProviderRuntimeError(f"generation provider returned non-JSON metadata: {raw[:300]}") from exc
        return GeneratedMetadata(
            title=str(payload.get("title") or "Untitled document")[:512],
            summary=str(payload.get("summary") or ""),
            tags=_json_list(payload, "tags", 20),
            language=payload.get("language"),
            document_type=payload.get("document_type"),
            people=_json_list(payload, "people", 30),
            organizations=_json_list(payload, "organizations", 30),
            key_dates=_json_list(payload, "key_dates", 30),
        )


def get_ocr_provider() -> OCRProvider:
    return LlamaCppOCRProvider()


def get_embedding_provider() -> EmbeddingProvider:
    return LlamaCppEmbeddingProvider()


def get_text_generation_provider() -> TextGenerationProvider:
    return LlamaCppTextGenerationProvider()
