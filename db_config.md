# DB와 MinIO 설정

실제 백엔드 연결 값은 `apps/backend/.env`에 둡니다. 이 파일에는 비밀 값을 기록하지 않습니다.

필요한 변수:

```env
DATABASE_URL=
MINIO_ENDPOINT=
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_BUCKET=
OBJECT_STORAGE_BACKEND=
```

환경변수가 있으면 `apps/backend/.env`보다 우선합니다. `OBJECT_STORAGE_BACKEND`는 `local` 또는 `minio`를 사용할 수 있습니다.
