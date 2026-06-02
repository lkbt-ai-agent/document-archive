from __future__ import annotations

import uuid
from datetime import timedelta
from email.utils import encode_rfc2231
from io import BytesIO
from pathlib import Path

from minio import Minio

from app.core.config import get_settings


class StorageService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def save(
        self,
        filename: str,
        content: bytes,
        content_type: str,
        category: str = "originals",
        document_id: uuid.UUID | None = None,
    ) -> tuple[str | None, str]:
        object_id = document_id or uuid.uuid4()
        object_key = f"documents/{category}/{object_id}/{Path(filename).name}"
        if self.settings.storage_backend == "minio":
            return self._save_minio(object_key, content, content_type)
        return self._save_local(object_key, content)

    def _save_local(self, object_key: str, content: bytes) -> tuple[str | None, str]:
        self.settings.local_storage_dir.mkdir(parents=True, exist_ok=True)
        path = self.settings.local_storage_dir / object_key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return None, str(path.relative_to(self.settings.local_storage_dir.parent))

    def _save_minio(self, object_key: str, content: bytes, content_type: str) -> tuple[str | None, str]:
        client = self._minio_client()
        assert self.settings.minio_bucket is not None
        if not client.bucket_exists(self.settings.minio_bucket):
            client.make_bucket(self.settings.minio_bucket)
        client.put_object(self.settings.minio_bucket, object_key, BytesIO(content), length=len(content), content_type=content_type)
        return self.settings.minio_bucket, object_key

    def presigned_url(self, object_key: str, filename: str, *, download: bool, expires_seconds: int = 300) -> str:
        client = self._minio_client()
        assert self.settings.minio_bucket is not None
        disposition_type = "attachment" if download else "inline"
        disposition = f"{disposition_type}; filename*={encode_rfc2231(filename, 'utf-8')}"
        return client.presigned_get_object(
            self.settings.minio_bucket,
            object_key,
            expires=timedelta(seconds=expires_seconds),
            response_headers={"response-content-disposition": disposition},
        )

    def local_path(self, storage_object_key: str) -> Path:
        object_key = Path(storage_object_key)
        if object_key.parts and object_key.parts[0] == self.settings.local_storage_dir.name:
            return self.settings.local_storage_dir.parent / object_key
        return self.settings.local_storage_dir / object_key

    def _minio_client(self) -> Minio:
        if not all([self.settings.minio_endpoint, self.settings.minio_access_key, self.settings.minio_secret_key, self.settings.minio_bucket]):
            raise RuntimeError("MinIO is enabled but MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, or MINIO_BUCKET is missing in @db_config.md/environment.")
        endpoint = self.settings.minio_endpoint.removeprefix("http://").removeprefix("https://")
        secure = self.settings.minio_endpoint.startswith("https://")
        return Minio(endpoint, access_key=self.settings.minio_access_key, secret_key=self.settings.minio_secret_key, secure=secure)
