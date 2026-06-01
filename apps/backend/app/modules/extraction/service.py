from __future__ import annotations

from io import BytesIO

from pypdf import PdfReader

from app.ai.providers import OCRProvider


IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
TEXT_MIME_TYPES = {"text/plain", "text/markdown"}
PDF_MIME_TYPES = {"application/pdf"}
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf", ".txt", ".md"}


class TextExtractionService:
    def __init__(self, ocr_provider: OCRProvider) -> None:
        self.ocr_provider = ocr_provider

    def extract(self, content: bytes, filename: str, mime_type: str) -> str:
        if mime_type in TEXT_MIME_TYPES or filename.lower().endswith((".txt", ".md")):
            return content.decode("utf-8", errors="replace")
        if mime_type in PDF_MIME_TYPES or filename.lower().endswith(".pdf"):
            reader = PdfReader(BytesIO(content))
            return "\n\n".join(page.extract_text() or "" for page in reader.pages).strip()
        if mime_type in IMAGE_MIME_TYPES or filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
            return self.ocr_provider.extract_text(content, mime_type)
        raise ValueError("Unsupported file type. Supported types: jpg, png, webp, PDF, txt, md.")


def chunk_text(text: str, chunk_size: int = 1200, overlap: int = 160) -> list[str]:
    normalized = "\n".join(line.rstrip() for line in text.splitlines()).strip()
    if not normalized:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(normalized):
        end = min(start + chunk_size, len(normalized))
        chunks.append(normalized[start:end].strip())
        if end == len(normalized):
            break
        start = max(0, end - overlap)
    return [chunk for chunk in chunks if chunk]
