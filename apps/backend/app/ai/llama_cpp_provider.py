from __future__ import annotations

import base64
import json
import os
from pathlib import Path
from typing import Any

import httpx

from app.ai.providers import AIProviderRuntimeError, EmbeddingProvider, GeneratedMetadata, OCRProvider, TextGenerationProvider
from app.core.config import get_settings


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
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as exc:
            raise AIProviderRuntimeError(f"{self.role} provider request failed at {url}: {exc}") from exc


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

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        data = self._post({"model": self.model_name, "input": texts})
        return [item["embedding"] for item in data["data"]]


class LlamaCppTextGenerationProvider(_LlamaProviderBase, TextGenerationProvider):
    def __init__(self) -> None:
        super().__init__("generation")

    def complete(self, system_prompt: str, user_prompt: str, temperature: float = 0.2) -> str:
        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "chat_template_kwargs": {"enable_thinking": False},
        }
        data = self._post(payload)
        return data["choices"][0]["message"]["content"].strip()

    def generate_metadata(self, text: str) -> GeneratedMetadata:
        system = "You produce compact JSON metadata for archived documents."
        user = (
            "Create metadata for this document. Return JSON only with keys: "
            "title, summary, tags, language, document_type. "
            f"Document text:\n{text[:6000]}"
        )
        raw = self.complete(system, user, temperature=0.1)
        try:
            payload = json.loads(raw.strip().removeprefix("```json").removesuffix("```").strip())
        except json.JSONDecodeError as exc:
            raise AIProviderRuntimeError(f"generation provider returned non-JSON metadata: {raw[:300]}") from exc
        return GeneratedMetadata(
            title=str(payload.get("title") or "Untitled document")[:512],
            summary=str(payload.get("summary") or ""),
            tags=[str(tag) for tag in payload.get("tags", [])][:20],
            language=payload.get("language"),
            document_type=payload.get("document_type"),
        )


def get_ocr_provider() -> OCRProvider:
    return LlamaCppOCRProvider()


def get_embedding_provider() -> EmbeddingProvider:
    return LlamaCppEmbeddingProvider()


def get_text_generation_provider() -> TextGenerationProvider:
    return LlamaCppTextGenerationProvider()
