# 백엔드

FastAPI 문서 아카이브 API.

## 실행

```bash
cd apps/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- 상태 확인: `GET /health`
- 문서: `http://127.0.0.1:8000/docs`
- 접두사: `/api/v1`

## 설정

- `.env`: DB, MinIO.
- `.env.local-ai`: llama.cpp URL/모델.
- `../../config/ai_providers.json`: OCR/embedding/generation 매핑.
- 시작 시 pgvector 확장과 SQLAlchemy 테이블 생성.

## 주요 기능

- 폴더 CRUD.
- 문서 업로드/조회/보기/다운로드/삭제.
- PDF/text/image 추출.
- 메타데이터, 청킹, 임베딩.
- 키워드/의미 검색.
- AI 생성 문서, 계보.
