# 문서 아카이브

## 주요 스펙
- Next.js
- FastAPI
- PostgreSQL/pgvector
- MinIO
- llama.cpp 로컬 AI

## 실행

### 백엔드

```bash
cd apps/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- API: `http://127.0.0.1:8000/api/v1`
- 문서: `http://127.0.0.1:8000/docs`

외부 기기에서 백엔드 문서를 직접 열 때:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 프론트엔드

```bash
cd apps/frontend
npm install
npm run dev
```

- UI: `http://localhost:3000`
- 기본 API: `/api/v1` -> Next.js 프록시 -> `127.0.0.1:8000`
- API 변경: `NEXT_PUBLIC_BACKEND_API_URL=http://host:port npm run dev`

외부 기기에서 UI 접속:

```bash
npm run dev -- --hostname 0.0.0.0
```

이 경우 브라우저는 프론트엔드의 `/api/v1`만 호출하고, Next.js가 같은 머신의 백엔드로 전달함.

## 설정

- 백엔드: `apps/backend/.env` 또는 환경변수.
- 예시: `apps/backend/.env.example`.
- 필수: `DATABASE_URL`.
- 선택 MinIO: `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`.
- 저장소: 기본 `apps/backend/.data/uploads`; 변경 `LOCAL_STORAGE_DIR`.
- 저장소 모드: `OBJECT_STORAGE_BACKEND=local|minio`.
- 로컬 AI: `.env.local-ai`, 예시 `.env.local-ai.example`.
- AI 매핑: `config/ai_providers.json`.

주요 로컬 AI 값:

- `LLAMA_CPP_SERVER_BIN`
- `LLAMA_CPP_OCR_BASE_URL`, `LOCAL_AI_OCR_MODEL_PATH`, `LOCAL_AI_OCR_MMPROJ_PATH`
- `LLAMA_CPP_EMBEDDING_BASE_URL`, `LOCAL_AI_EMBEDDING_MODEL_PATH`
- `LLAMA_CPP_GENERATION_BASE_URL`, `LOCAL_AI_GENERATION_MODEL_PATH`

```bash
python3 scripts/start_local_ai_provider.py ocr
python3 scripts/start_local_ai_provider.py embedding
python3 scripts/start_local_ai_provider.py generation
python3 scripts/local_ai_health_check.py
```

## 기능

- 폴더/문서 관리.
- PDF, 이미지, 텍스트, Markdown 업로드.
- 텍스트 추출, 메타데이터 생성, 청킹, 임베딩.
- 키워드 검색과 의미 검색.
- 요약, 초안, 보고서, 문체 변경, 문서 병합.

구조: [architecture/architecture.md](architecture/architecture.md).
