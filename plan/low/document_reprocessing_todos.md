# 문서 재처리 TODO

## 범위

처리 실패 또는 오래된 문서를 저장된 원본에서 다시 처리합니다.

## 백엔드

- `POST /api/v1/documents/{document_id}/process`가 현재 `409`를 반환합니다.
- 저장된 원본을 로컬 디스크 또는 MinIO에서 다시 읽어야 합니다.
- 추출, 메타데이터 생성, 청킹, 임베딩을 재실행해야 합니다.
- 기존 `DocumentMetadata`, `DocumentChunk`를 교체하거나 버전 처리해야 합니다.
- 현재 오류 문구의 "synchronously" 표현은 `BackgroundTasks` 기반 업로드 처리와 맞지 않습니다.

## 프론트엔드

- 실패 문서에 재처리 버튼이 없습니다.
- 재처리 요청 후 `processing`, `ready`, `failed` 상태 전환을 표시해야 합니다.
- 오류 원인별 안내와 재시도 흐름이 필요합니다.
