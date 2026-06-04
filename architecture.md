# 아키텍처

개인 문서를 업로드하고, 텍스트를 추출하고, 로컬 AI로 메타데이터와 임베딩을 만든 뒤 검색과 AI 문서 생성을 제공하는 아카이브입니다.

## 구성

- 프론트엔드: `apps/frontend/`의 Next.js 16 앱.
- 백엔드: `apps/backend/`의 FastAPI 앱.
- 데이터베이스: PostgreSQL + pgvector.
- 파일 저장소: 기본은 로컬 디스크, `OBJECT_STORAGE_BACKEND=minio`이면 MinIO.
- AI 런타임: `config/ai_providers.json`과 `.env.local-ai`로 연결하는 llama.cpp OpenAI 호환 서버.

## 현재 흐름

```text
Next.js UI
  -> FastAPI /api/v1
  -> PostgreSQL + pgvector
  -> 로컬 파일 또는 MinIO
  -> llama.cpp OCR, embedding, generation 제공자
```

업로드는 동기 처리입니다. 백엔드는 원본 파일을 저장하고, PDF/텍스트/이미지에서 텍스트를 추출하고, 메타데이터를 생성하고, 청크를 임베딩한 뒤 `ready` 또는 `failed` 상태를 기록합니다.

## 주요 기능

- 폴더: 생성, 이름 변경, 이동, 삭제.
- 문서: 업로드, 목록, 상세, 원본 보기/다운로드, 삭제.
- 추출: PDF는 `pypdf`, 텍스트는 UTF-8 디코딩, 이미지는 OCR 제공자.
- 검색: 키워드 검색, pgvector 기반 의미 검색, RAG 답변 API.
- AI 작업: 요약, 초안, 보고서, 문체 변경, 문서 병합.
- 계보: 생성 문서의 출처 문서, 프롬프트, 모델, 파라미터 기록.

## 문서

- [백엔드와 API](docs/backend_api.md)
- [데이터 모델](docs/data_model.md)
- [AI와 RAG](docs/ai_rag.md)
- [로컬 AI 모델](docs/local_ai_models.md)
- [스토리지와 인프라](docs/storage_infra.md)

## 비목표

- Kubernetes, 마이크로서비스, 별도 벡터 DB는 사용하지 않습니다.
- 초기 구현은 큐/워크플로 엔진 없이 요청 안에서 처리합니다.
