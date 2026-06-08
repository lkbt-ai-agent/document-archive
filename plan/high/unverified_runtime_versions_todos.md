# 확인 필요 런타임/서비스 버전 점검 계획

## 범위

아키텍처 문서에는 저장소 파일만으로 확정할 수 없는 항목을 `버전 확인 필요`로 표기했습니다. 이 문서는 해당 항목의 실제 major 버전을 확인해 문서에 반영하기 위한 짧은 계획입니다.

## 확인 대상

- PostgreSQL server major version.
- pgvector PostgreSQL extension version.
- MinIO server major/release version.
- llama.cpp/llama-server build version.

## 확인 명령 후보

```bash
psql --version
psql "$DATABASE_URL" -c "SELECT extversion FROM pg_extension WHERE extname = 'vector';"
mc --version
curl "$MINIO_ENDPOINT/minio/health/live"
"$LLAMA_CPP_SERVER_BIN" --version
```

## 문서 반영 위치

- `README.md`
- `architecture/architecture.md`
- `architecture/backend_api.md`
- `architecture/data_model.md`
- `architecture/ai_rag.md`
- `architecture/local_ai_models.md`
- `architecture/storage_infra.md`
- `architecture/flow/*.md`
- `apps/backend/README.md`

## 완료 기준

- 확인 가능한 항목은 `버전 확인 필요` 대신 major 버전 또는 release 계열로 교체합니다.
- 환경별로 달라 고정하면 안 되는 항목은 `운영 환경별 확인`으로 유지하고, 확인 명령만 문서에 남깁니다.
