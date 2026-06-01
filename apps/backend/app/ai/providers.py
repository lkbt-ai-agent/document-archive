from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


class AIProviderRuntimeError(RuntimeError):
    pass


@dataclass(frozen=True)
class GeneratedMetadata:
    title: str
    summary: str
    tags: list[str]
    language: str | None = None
    document_type: str | None = None


class OCRProvider(ABC):
    @abstractmethod
    def extract_text(self, image_bytes: bytes, mime_type: str) -> str:
        raise NotImplementedError


class EmbeddingProvider(ABC):
    model_name: str

    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError


class TextGenerationProvider(ABC):
    model_name: str

    @abstractmethod
    def complete(self, system_prompt: str, user_prompt: str, temperature: float = 0.2) -> str:
        raise NotImplementedError

    @abstractmethod
    def generate_metadata(self, text: str) -> GeneratedMetadata:
        raise NotImplementedError
