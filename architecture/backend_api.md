# 백엔드와 API

백엔드는 FastAPI 앱입니다. 진입점은 `apps/backend/app/main.py`이고 모든 업무 API는 `/api/v1` 아래에 있습니다.

## 구조

```text
apps/backend/app/
  main.py
  core/config.py
  core/database.py
  api/v1/{router,folders,documents,search,generation,schemas}.py
  db/models.py
  modules/{documents,extraction,storage}/service.py
  ai/{providers,llama_cpp_provider}.py
```

시작 시 `.env`와 `.env.local-ai`를 읽고, PostgreSQL pgvector 확장과 SQLAlchemy 테이블을 준비합니다.

## 라우터

### 공통

- `GET /health`: 상태 확인.

기본 CORS 허용 origin은 `http://localhost:3000`, `http://127.0.0.1:3000`입니다. `BACKEND_CORS_ORIGINS`로 추가할 수 있고, Tailscale `*.ts.net:3000` 개발 origin도 정규식으로 허용합니다.

### 폴더

- `GET /api/v1/folders`: 폴더 목록.
- `POST /api/v1/folders`: 폴더 생성.
- `PATCH /api/v1/folders/{folder_id}`: 이름 변경 또는 부모 변경.
- `DELETE /api/v1/folders/{folder_id}`: 폴더 삭제. ORM cascade로 하위 폴더와 문서도 삭제됩니다.

### 문서

- `POST /api/v1/documents/upload`: 원본 저장 후 `processing` 문서 반환. 실제 처리는 `BackgroundTasks`.
- `GET /api/v1/documents?root_only=true`: 루트 문서 목록.
- `GET /api/v1/documents?folder_id={id}`: 폴더 문서 목록.
- `GET /api/v1/documents/{document_id}`: 문서 상세.
- `GET /api/v1/documents/{document_id}/content`: 추출 청크 목록.
- `GET /api/v1/documents/{document_id}/view`: 원본 파일 inline 보기.
- `GET /api/v1/documents/{document_id}/download`: 원본 파일 다운로드.
- `POST /api/v1/documents/{document_id}/process`: 현재 `409` 반환. 저장 객체 재처리는 미구현입니다.
- `DELETE /api/v1/documents/{document_id}`: 문서 삭제.

지원 확장자: `.jpg`, `.jpeg`, `.png`, `.webp`, `.pdf`, `.txt`, `.md`.

### 검색

- `POST /api/v1/search/keyword`: 청크 내용 `ILIKE` 검색.
- `POST /api/v1/search/semantic`: 쿼리 임베딩 후 pgvector 코사인 거리 검색.
- `POST /api/v1/search/rag`: 의미 검색 결과를 근거로 답변과 인용 청크 반환.

검색 필터는 현재 `folder_id`, `root_only`, `limit`만 지원합니다.

### AI 작업

- `POST /api/v1/ai-actions/summarize`
- `POST /api/v1/ai-actions/draft`
- `POST /api/v1/ai-actions/report`
- `POST /api/v1/ai-actions/rewrite-style`
- `POST /api/v1/ai-actions/merge-documents`
- `GET /api/v1/ai-actions/{generated_document_id}/lineage`

AI 작업은 먼저 빈 생성 문서를 만들고 `BackgroundTasks`에서 완료합니다. 출처 문서의 청크 텍스트를 모아 generation 제공자에 전달하고, 결과를 생성 문서로 저장합니다. 계보 API는 출처 문서 ID, 출처 청크 ID, 작업, 프롬프트, 모델, 제공자, 파라미터를 반환합니다.

## 처리 방식

업로드 API는 요청 안에서 원본 저장과 `Document` 레코드 생성까지만 처리합니다.

```text
upload
  -> save original
  -> create Document(processing)
  -> return 201
  -> BackgroundTasks:
       extract text
       generate metadata
       chunk text
       embed chunks
       mark ready or failed
```

확장자 오류는 `415`, 없는 폴더는 `404`를 반환합니다. 백그라운드 처리 실패는 이미 반환된 응답을 바꾸지 않고 `processing_status=failed`, `processing_error`, `upload_elapsed_seconds`를 저장합니다.
