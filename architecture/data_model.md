# 데이터 모델

PostgreSQL이 주 저장소입니다. pgvector는 `DocumentChunk.embedding` 벡터를 같은 DB 안에 저장합니다. 원본/생성 파일 본문은 DB가 아니라 로컬 디스크 또는 MinIO에 저장하고, DB에는 위치만 기록합니다.

테이블은 SQLAlchemy 모델에서 생성합니다.

## Folder

저장소: PostgreSQL `folders`.

- `id`
- `parent_id`
- `name`
- `path`
- `created_at`, `updated_at`

폴더는 자기 참조 트리입니다. 이름 변경이나 이동 시 하위 폴더의 `path`도 갱신합니다.

## Document

저장소: PostgreSQL `documents`.

파일 본문 저장소:

- 로컬 모드: `apps/backend/.data/uploads` 또는 `LOCAL_STORAGE_DIR`.
- MinIO 모드: `MINIO_BUCKET`.
- DB 기록: `storage_bucket`, `storage_object_key`.

- `id`
- `folder_id`
- `title`
- `corrected_filename`
- `original_filename`
- `mime_type`
- `file_size`
- `checksum_sha256`
- `storage_bucket`
- `storage_object_key`
- `is_generated`
- `source_type`: `uploaded`, `generated`
- `processing_status`: `pending`, `processing`, `ready`, `failed`
- `processing_error`
- `upload_elapsed_seconds`
- `created_at`, `updated_at`

업로드 파일과 AI 생성 문서는 모두 `documents`에 저장합니다.

`created_at`은 UI에서 파일 등록일로 표시합니다. `updated_at`은 파일 내용이나 처리 결과가 바뀐 시점을 의미하며, 단순 폴더 이동만으로 변경하지 않습니다. 문서의 폴더 이동은 `folder_id` 변경으로 표현하지만 `updated_at`은 보존합니다.

`mime_type`은 검색 필터 UI의 파일 유형 판정 기준입니다. PDF는 `application/pdf`, 이미지는 `image/*`, 텍스트는 `text/*`와 markdown/text 계열 MIME으로 분류합니다. 이 MIME 기반 파일 유형은 AI 메타데이터의 `DocumentMetadata.document_type`과 별개입니다.

## DocumentMetadata

저장소: PostgreSQL `document_metadata`.

값 출처: generation 제공자가 만든 JSON 메타데이터. AI 호출 실패 시 업로드 처리는 실패합니다. 생성 문서는 메타데이터 생성 실패 시 간단한 fallback 요약을 저장합니다.

- `document_id`
- `summary`
- `tags`
- `language`
- `document_type`
- `people`
- `organizations`
- `key_dates`
- `model_name`
- `model_version`
- `generated_at`

메타데이터 생성 프롬프트는 제목, 요약, 태그, 언어, 문서 유형, 인물, 조직, 주요 날짜를 채웁니다.

## DocumentChunk

저장소: PostgreSQL `document_chunks`. `embedding`은 pgvector 컬럼입니다.

- `document_id`
- `chunk_index`
- `page_start`, `page_end`
- `content`
- `token_count`
- `embedding`: `Vector(1024)`
- `embedding_model`
- `embedding_version`
- `created_at`

기본 청크 크기는 360자, overlap은 60자입니다. 의미 검색은 `embedding.cosine_distance()`로 정렬합니다.

## GeneratedDocumentLineage

저장소: PostgreSQL `generated_document_lineage`.

기록 대상: AI 생성 문서, 출처 문서 ID, 실제 프롬프트에 들어간 출처 청크 ID, 작업 종류, 프롬프트, 모델, 제공자, 생성 파라미터.

- `generated_document_id`
- `source_document_ids`
- `source_chunk_ids`
- `operation`: `summary`, `draft`, `report`, `rewrite_style`, `merge`, `generated_from_prompt`
- `prompt`
- `model_name`
- `provider_name`
- `generation_params`
- `workflow_dna`
- `created_at`

현재 생성 흐름은 출처 문서 ID와 선택된 출처 청크 ID를 모두 기록합니다.

## 인덱스 상태

현재 모델은 테이블과 pgvector 확장을 생성하지만 별도 관계형 인덱스나 HNSW 인덱스를 정의하지 않습니다. 데이터가 커지면 다음 인덱스가 필요합니다.

- `folders(parent_id)`
- `documents(folder_id)`
- `documents(processing_status)`
- `document_chunks(document_id, chunk_index)`
- `document_chunks.embedding` HNSW
