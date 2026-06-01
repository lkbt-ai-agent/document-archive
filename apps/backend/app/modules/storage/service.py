from __future__ import annotations

import uuid
from pathlib import Path

from minio import Minio

from app.core.config import get_settings


class StorageService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def save(self, filename: str, content: bytes, content_type: str) -> tuple[str | None, str]:
        object_key = f"{uuid.uuid4()}-{Path(filename).name}"
        if self.settings.storage_backend == "minio":
            return self._save_minio(object_key, content, content_type)
        return self._save_local(object_key, content)

    def _save_local(self, object_key: str, content: bytes) -> tuple[str | None, str]:
        self.settings.local_storage_dir.mkdir(parents=True, exist_ok=True)
        path = self.settings.local_storage_dir / object_key
        path.write_bytes(content)
        return None, str(path.relative_to(self.settings.local_storage_dir.parent))

    def _save_minio(self, object_key: str, content: bytes, content_type: str) -> tuple[str | None, str]:
        if not all([self.settings.minio_endpoint, self.settings.minio_access_key, self.settings.minio_secret_key, self.settings.minio_bucket]):
            raise RuntimeError("MinIO is enabled but MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, or MINIO_BUCKET is missing in @db_config.md/environment.")
        endpoint = self.settings.minio_endpoint.removeprefix("http://").removeprefix("https://")
        secure = self.settings.minio_endpoint.startswith("https://")
        client = Minio(endpoint, access_key=self.settings.minio_access_key, secret_key=self.settings.minio_secret_key, secure=secure)
        if not client.bucket_exists(self.settings.minio_bucket):
            client.make_bucket(self.settings.minio_bucket)
        from io import BytesIO

        client.put_object(self.settings.minio_bucket, object_key, BytesIO(content), length=len(content), content_type=content_type)
        return self.settings.minio_bucket, object_key
