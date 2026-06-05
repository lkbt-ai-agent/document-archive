# 데이터 모델

PostgreSQL이 주 저장소이고 pgvector가 의미 검색 벡터를 저장합니다. 테이블은 SQLAlchemy 모델에서 생성됩니다.

## Folder

- `id`
- `parent_id`
- `name`
- `path`
- `created_at`, `updated_at`

폴더는 자기 참조 트리입니다. 이름 변경이나 이동 시 하위 폴더의 `path`도 갱신합니다.

## Document

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

## DocumentMetadata

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

- `document_id`
- `chunk_index`
- `page_start`, `page_end`
- `content`
- `token_count`
- `embedding`: `Vector(1024)`
- `embedding_model`
- `embedding_version`
- `created_at`

기본 청크 크기는 360자, overlap은 60자입니다. 의미 검색은 `embedding.cosine_distance()`를 사용합니다.

## GeneratedDocumentLineage

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

현재 생성 흐름은 출처 문서 ID를 기록합니다. 출처 청크 ID는 컬럼만 있고 채우지 않습니다.

## 인덱스 상태

현재 모델은 테이블과 pgvector 확장을 생성하지만 별도 관계형 인덱스나 HNSW 인덱스를 정의하지 않습니다. 데이터가 커지면 다음 인덱스가 필요합니다.

- `folders(parent_id)`
- `documents(folder_id)`
- `documents(processing_status)`
- `document_chunks(document_id, chunk_index)`
- `document_chunks.embedding` HNSW
