# 데이터베이스 인덱스 TODO

## 범위

문서 수와 청크 수 증가에 대비해 조회와 검색 성능을 보강합니다.

## 백엔드

- 현재 테이블 생성은 있지만 별도 관계형 인덱스와 HNSW 벡터 인덱스가 정의되어 있지 않습니다.
- 후보 인덱스:
  - `folders(parent_id)`
  - `documents(folder_id)`
  - `documents(processing_status)`
  - `document_chunks(document_id, chunk_index)`
  - `document_chunks.embedding` HNSW
- 실제 데이터 규모와 쿼리 패턴 기준으로 적용 순서를 정해야 합니다.
