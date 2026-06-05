# 백엔드

FastAPI 문서 아카이브 API.

## 설정

```bash
cp .env.example .env
```

- 필수: `DATABASE_URL`.
- 선택 MinIO: `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`.
- 저장소 모드: `OBJECT_STORAGE_BACKEND=local|minio`.
- 로컬 저장 기본값: `apps/backend/.data/uploads`.
- 저장 위치 변경: `LOCAL_STORAGE_DIR`.
- 로컬 AI 파일: 루트 `.env.local-ai`.
- AI 매핑: `../../config/ai_providers.json`.
- 임베딩 차원 변경 시 `LOCAL_AI_EMBEDDING_DIMENSION`과 DB 모델을 함께 맞춤.
- 시작 시 pgvector 확장과 SQLAlchemy 테이블 생성.

## 실행

백엔드:

```bash
cd apps/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

로컬 LLM 제공자는 로그를 따로 보기 위해 각각 별도 shell에서 실행합니다. 아래 명령은 프로젝트 루트에서 실행합니다.

OCR 모델:

```bash
python3 scripts/start_local_ai_provider.py ocr
```

임베딩 모델:

```bash
python3 scripts/start_local_ai_provider.py embedding
```

문서 생성/요약 모델:

```bash
python3 scripts/start_local_ai_provider.py generation
```

기본 포트는 OCR `8081`, 임베딩 `8082`, 생성 `8083`입니다. 실행 전 루트 `.env.local-ai`에 `LLAMA_CPP_SERVER_BIN`, 역할별 모델 경로, 역할별 base URL이 설정되어 있어야 합니다.

UI 를 거치지 않고 외부 기기에서 API 문서를 직접 열 때:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- `127.0.0.1`: 같은 머신에서만 접속.
- `0.0.0.0`: LAN/Tailscale 포함 모든 인터페이스에서 접속 허용.
- 외부 UI만 쓸 때는 백엔드를 `127.0.0.1:8000`으로 두고, 프론트엔드 프록시를 통해 접근해도 됨.

## 검증

- 상태: `GET /health`
- 문서: `http://127.0.0.1:8000/docs`
- 접두사: `/api/v1`
- 프론트엔드는 `/api/v1` 프록시를 사용해 브라우저에 백엔드 주소를 직접 노출하지 않고, Tailscale/외부 접속에서도 같은 origin으로 API를 호출함.

```bash
cd ../..
python3 scripts/local_ai_health_check.py
```

## 구조

- `app/main.py`: 앱 진입점.
- `app/api/v1`: API 라우터.
- `app/modules`: 도메인 서비스.
- `app/ai`: AI provider.
- `app/db/models.py`: SQLAlchemy 모델.

## 주요 기능

- 폴더 CRUD.
- 문서 업로드/조회/보기/다운로드/삭제.
- PDF/text/image 추출.
- 메타데이터, 청킹, 임베딩.
- 키워드/의미 검색.
- AI 생성 문서, 계보.
