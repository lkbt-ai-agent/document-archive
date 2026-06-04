# 백엔드

FastAPI 기반 문서 아카이브 API입니다.

## 실행

```bash
cd apps/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- 상태 확인: `GET /health`
- API 문서: `http://127.0.0.1:8000/docs`
- API 접두사: `/api/v1`

## 설정

- `.env`: `DATABASE_URL`, MinIO 값.
- `.env.local-ai`: llama.cpp 서버 URL과 모델 경로.
- `../../config/ai_providers.json`: OCR, embedding, generation 제공자 매핑.

백엔드는 시작 시 pgvector 확장을 만들고 SQLAlchemy 모델 테이블을 생성합니다.

## 주요 기능

- 폴더 CRUD.
- 문서 업로드, 조회, 보기, 다운로드, 삭제.
- PDF/텍스트/이미지 텍스트 추출.
- 메타데이터 생성, 청킹, 임베딩.
- 키워드 검색, 의미 검색.
- AI 생성 문서와 계보 저장.
