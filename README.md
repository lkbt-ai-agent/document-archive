# 문서 아카이브

개인 문서 업로드, 검색, AI 문서 생성을 위한 로컬 우선 아카이브.

## 주요 스펙

- Next.js
- FastAPI
- PostgreSQL/pgvector
- MinIO (or 로컬 스토리지)
- llama.cpp 로컬 AI

## 구조

- `apps/backend`: FastAPI API.
- `apps/frontend`: Next.js UI.
- `architecture`: 설계 문서.
- `plan`: 작업 계획.
- `config`: AI provider 설정.
- `scripts`: 로컬 AI 실행/점검 스크립트.

## 사전 조건

- Python
- Node.js/npm
- PostgreSQL + pgvector
- llama.cpp
- 선택: MinIO

## 빠른 시작

1. DB 준비.
2. `apps/backend/.env` 작성.
3. 필요 시 `.env.local-ai` 작성.
4. 백엔드 실행: [apps/backend/README.md](apps/backend/README.md).
5. 프론트엔드 실행: [apps/frontend/README.md](apps/frontend/README.md).

## 설정

- 백엔드: `apps/backend/.env`, 예시 `apps/backend/.env.example`.
- 로컬 AI: `.env.local-ai`, 예시 `.env.local-ai.example`.
- AI 매핑: `config/ai_providers.json`.

## 기능

- 폴더/문서 관리.
- PDF, 이미지, 텍스트, Markdown 업로드.
- 텍스트 추출, 메타데이터 생성, 청킹, 임베딩.
- 키워드 검색과 의미 검색.
- 요약, 초안, 보고서, 문체 변경, 문서 병합.

## 문서

- [아키텍처](architecture/architecture.md)
- [백엔드와 API](architecture/backend_api.md)
- [로컬 AI 모델](architecture/local_ai_models.md)
- [스토리지와 인프라](architecture/storage_infra.md)
