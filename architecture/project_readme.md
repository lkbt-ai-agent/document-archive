# 문서 아카이브

Next.js, FastAPI, PostgreSQL/pgvector, 선택형 MinIO, 로컬 llama.cpp 모델을 사용하는 개인 문서 아카이브입니다.

## 실행

백엔드:

```bash
cd apps/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Tailscale에서 프론트엔드를 통해 API를 사용할 때는 Next.js 프록시가 같은 머신의 `127.0.0.1:8000`으로 백엔드 요청을 전달합니다. 백엔드 API 문서까지 직접 열려면 모든 인터페이스에 바인딩합니다.

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

프론트엔드:

```bash
cd apps/frontend
npm install
npm run dev
```

Tailscale 등 다른 기기에서 접속하려면 프론트엔드도 모든 인터페이스에 바인딩합니다.

```bash
npm run dev -- --hostname 0.0.0.0
```

- UI: `http://localhost:3000`
- API 문서: `http://127.0.0.1:8000/docs`
- 프론트엔드 기본 API 주소: `/api/v1` same-origin 프록시
- Tailscale 예시: `http://xxx-macmini.tail902fcf.ts.net:3000/`에서 API는 `http://xxx-macmini.tail902fcf.ts.net:3000/api/v1`로 호출되고 Next.js가 `http://127.0.0.1:8000/api/v1`로 전달
- 다른 백엔드 주소: `NEXT_PUBLIC_BACKEND_API_URL=http://host:port npm run dev`

## 설정

- DB/MinIO: `apps/backend/.env` 또는 환경변수.
- 로컬 AI: `.env.local-ai`와 `config/ai_providers.json`.
- 로컬 파일 저장 위치: 기본 `apps/backend/.data/uploads`, `LOCAL_STORAGE_DIR`로 변경 가능.

필수 로컬 AI 예시:

```bash
LLAMA_CPP_OCR_BASE_URL=http://127.0.0.1:8081
LLAMA_CPP_EMBEDDING_BASE_URL=http://127.0.0.1:8082
LLAMA_CPP_GENERATION_BASE_URL=http://127.0.0.1:8083
LOCAL_AI_OCR_MODEL_PATH=/absolute/path/to/ocr.gguf
LOCAL_AI_OCR_MMPROJ_PATH=/absolute/path/to/mmproj.gguf
LOCAL_AI_EMBEDDING_MODEL_PATH=/absolute/path/to/embedding.gguf
LOCAL_AI_GENERATION_MODEL_PATH=/absolute/path/to/generation.gguf
```

제공자 시작:

```bash
python3 scripts/start_local_ai_provider.py ocr
python3 scripts/start_local_ai_provider.py embedding
python3 scripts/start_local_ai_provider.py generation
```

상태 확인:

```bash
python3 scripts/local_ai_health_check.py
python3 scripts/verify_local_ai.py --image /absolute/path/to/sample-image.png
```

## 기능

- 폴더와 문서 관리.
- PDF, 이미지, 텍스트, Markdown 업로드.
- 텍스트 추출, 메타데이터 생성, 청킹, 임베딩.
- 키워드 검색과 의미 검색.
- 요약, 초안, 보고서, 문체 변경, 문서 병합.

자세한 구조는 [architecture.md](architecture.md)를 참고합니다.
