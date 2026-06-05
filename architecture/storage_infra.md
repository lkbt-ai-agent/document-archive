# 스토리지와 인프라

설정 값은 `apps/backend/.env` 또는 환경변수에서 읽습니다.

## PostgreSQL + pgvector

백엔드는 시작 시 pgvector 확장을 만들고 SQLAlchemy 모델로 테이블을 생성합니다.

저장 데이터:

- 폴더
- 문서
- 메타데이터
- 청크
- 임베딩 벡터
- 생성 문서 계보

`DocumentChunk.embedding`은 기본 `Vector(1024)`입니다. `LOCAL_AI_EMBEDDING_DIMENSION`을 바꾸면 모델 정의도 함께 맞춰야 합니다.

## 파일 저장

`StorageService`는 같은 API로 로컬 디스크 또는 MinIO에 저장합니다.

```text
documents/
  originals/{document_id}/{filename}
  generated/{document_id}/{filename}
```

기본 로컬 위치는 `apps/backend/.data/uploads`입니다. `LOCAL_STORAGE_DIR`로 바꿀 수 있습니다.

## MinIO

MinIO 설정 네 값이 모두 있으면 기본 저장소가 MinIO가 됩니다. 명시적으로 바꾸려면 `OBJECT_STORAGE_BACKEND=local` 또는 `OBJECT_STORAGE_BACKEND=minio`를 사용합니다.

필요 값:

- `MINIO_ENDPOINT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_BUCKET`

보기와 다운로드 엔드포인트는 MinIO 객체에 대해 짧은 수명의 presigned URL로 리다이렉트합니다. 자격 증명은 프론트엔드에 노출하지 않습니다.

## 런타임 배치

```text
Next.js
  -> FastAPI
  -> PostgreSQL + pgvector
  -> local storage or MinIO
  -> llama.cpp servers
```
