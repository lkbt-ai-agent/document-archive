# 아키텍처

개인 문서를 저장, 추출, 검색, AI 생성하는 로컬 AI 중심 아카이브입니다.

## 구성

- 프론트엔드: `apps/frontend/` Next.js 16 + React 19.
- 백엔드: `apps/backend/` FastAPI 0.x + Pydantic 2 + SQLAlchemy 2.
- 데이터베이스: PostgreSQL 버전 확인 필요 + pgvector extension 버전 확인 필요.
- 파일 저장소: 기본 로컬 디스크, 선택 MinIO server 버전 확인 필요, minio-py 7.
- AI 런타임: llama.cpp 버전 확인 필요, OpenAI-compatible llama-server API.
- AI 모델: Qwen2.5-VL OCR, BGE-M3 embedding, Qwen3 generation.
- AI 설정: `config/ai_providers.json`, `.env.local-ai`.

## 현재 흐름

```text
Next.js 16 UI
  -> FastAPI 0.x /api/v1
  -> PostgreSQL + pgvector extension
  -> 로컬 파일 또는 MinIO server
  -> llama.cpp OpenAI-compatible provider
```

업로드 API는 원본 저장과 문서 레코드 생성을 먼저 끝낸 뒤 `processing` 문서를 반환합니다. 텍스트 추출, 메타데이터 생성, 청크 임베딩은 FastAPI 0.x `BackgroundTasks`에서 처리하고 `ready` 또는 `failed`를 기록합니다.

## 주요 기능

- 폴더: 생성, 이름 변경, 이동, 삭제.
- 문서: 업로드, 목록, 상세, 원본 보기, 다운로드, 삭제.
- 추출
  - PDF: `pypdf 5`
  - 텍스트: UTF-8 디코딩
  - 이미지: OCR 제공자
- 검색: 키워드 검색, pgvector extension 기반 의미 검색, RAG 답변 API.
- AI 작업: 요약, 초안, 보고서, 문체 변경, 문서 병합.
- 계보: 출처 문서, 출처 청크, 프롬프트, 모델, 제공자, 파라미터 기록.

## 문서

- [백엔드와 API](backend_api.md)
- [데이터 모델](data_model.md)
- [AI와 RAG](ai_rag.md)
- [로컬 AI 모델](local_ai_models.md)
- [스토리지와 인프라](storage_infra.md)
- [PDF 업로드 흐름](flow/pdf_upload_flow.md)
- [검색과 RAG 흐름](flow/search_rag_flow.md)
- [AI 생성 문서 흐름](flow/ai_generation_flow.md)

## 비목표

- Kubernetes, 마이크로서비스, 별도 벡터 DB 제외.
- 초기 구현은 큐/워크플로 엔진 제외.
