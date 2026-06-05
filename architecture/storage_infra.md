# 스토리지와 인프라

설정 값은 `apps/backend/.env` 또는 환경변수에서 읽습니다.

## PostgreSQL + pgvector

백엔드는 시작 시 `CREATE EXTENSION IF NOT EXISTS vector`를 실행하고 SQLAlchemy 모델로 테이블을 생성합니다.

저장 데이터:

- 폴더
- 문서
- 메타데이터
- 청크
- 임베딩 벡터
- 생성 문서 계보

`DocumentChunk.embedding`은 기본 `Vector(1024)`입니다. `LOCAL_AI_EMBEDDING_DIMENSION`을 바꾸면 모델 정의도 함께 맞춰야 합니다.

현재 시작 보정:

- `documents.folder_id`는 nullable로 보정합니다.
- `documents.corrected_filename` 컬럼을 없으면 추가합니다.
- `documents.upload_elapsed_seconds` 컬럼을 없으면 추가합니다.

## 파일 저장

`StorageService`는 같은 API로 로컬 디스크 또는 MinIO에 저장합니다.

```text
documents/
  originals/{document_id}/{filename}
  generated/{document_id}/{filename}
```

기본 로컬 위치는 `apps/backend/.data/uploads`입니다. `LOCAL_STORAGE_DIR`로 바꿀 수 있습니다.

로컬 저장 시 DB에는 `storage_bucket=NULL`, `storage_object_key`에 로컬 저장 루트 기준 상대 경로를 저장합니다. 기본값에서는 `uploads/documents/...` 형태입니다. 조회 시 `StorageService.local_path()`가 현재 `LOCAL_STORAGE_DIR` 기준으로 실제 파일 경로를 계산합니다.

## MinIO

MinIO 설정 네 값이 모두 있으면 기본 저장소가 MinIO가 됩니다. 명시적으로 바꾸려면 `OBJECT_STORAGE_BACKEND=local` 또는 `OBJECT_STORAGE_BACKEND=minio`를 사용합니다.

필요 값:

- `MINIO_ENDPOINT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_BUCKET`

보기와 다운로드 엔드포인트는 MinIO 객체에 대해 짧은 수명의 presigned URL로 리다이렉트합니다. 자격 증명은 프론트엔드에 노출하지 않습니다.

MinIO 저장 시 DB에는 `storage_bucket=MINIO_BUCKET`, `storage_object_key=documents/...`를 저장합니다. 버킷이 없으면 저장 시 생성합니다.

## 설정 로딩

백엔드는 `apps/backend/.env`와 `.env.local-ai`를 읽어 비어 있는 환경변수만 채웁니다.

1. `apps/backend/.env`
2. `.env.local-ai`

이미 export된 프로세스 환경변수가 최우선입니다. 두 파일에 같은 키가 있으면 먼저 읽는 `apps/backend/.env` 값이 유지됩니다.

## 런타임 배치

```text
Next.js
  -> FastAPI
  -> PostgreSQL + pgvector
  -> local storage or MinIO
  -> llama.cpp servers
```
