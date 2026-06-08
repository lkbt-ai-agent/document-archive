# 검색과 RAG 흐름

## 검색 필터 판단

vector/RAG 검색에 metadata filter를 붙이는 것 자체는 가능한 패턴입니다. 다만 현재 구현은 pgvector `cosine_distance()` 기반 단순 top-k 검색이고, filtered ANN 전용 최적화가 없습니다.

사용자가 조작하는 상세 필터를 의미 검색이나 RAG에 적용하면 유사도 품질이 떨어지거나 관련 문서가 retrieval 전에 제외될 수 있습니다. 따라서 파일 유형, 등록일, 처리 상태 같은 상세 필터는 키워드 검색에만 적용합니다. 의미 검색과 RAG는 `processing_status=ready`, `embedding IS NOT NULL` 같은 필수 범위 조건만 사용합니다.

헤더 검색 UI는 선택 폴더를 검색 API에 보내지 않습니다. 키워드, 의미, RAG 검색 모두 전체 폴더를 대상으로 실행됩니다.

## 키워드 검색

1. 클라이언트가 `/api/v1/search/keyword`에 질문, `limit`, 키워드 전용 상세 필터를 보냅니다.
2. 백엔드는 `DocumentChunk.content ILIKE`로 청크 내용을 검색합니다.
3. `file_types`가 있으면 `Document.mime_type` 기준으로 PDF, 이미지, 텍스트 조건을 적용합니다.
4. `created_from`, `created_to`가 있으면 `Document.created_at` 범위 조건을 적용합니다.
5. `processing_statuses`가 누락되거나 `null`이면 `ready` 문서만 검색합니다.
6. `processing_statuses`가 빈 배열이면 상태 조건을 적용하지 않습니다.
7. 결과는 청크 단위로 반환되지만 프론트엔드의 결과 목록은 고유 문서 row로 렌더링합니다.

## 의미 검색

1. 클라이언트가 `/api/v1/search/semantic`에 질문과 `limit`를 보냅니다.
2. 백엔드가 embedding 제공자에 질문 1개를 보내 벡터를 받습니다.
3. `processing_status=ready`이고 `embedding IS NOT NULL`인 청크만 조회합니다.
4. pgvector `cosine_distance()`로 질문 벡터와 청크 벡터를 비교합니다.
5. 거리가 작은 순서로 `limit`개를 반환합니다.
6. 응답 score는 `1 - distance`입니다.

## RAG 검색

1. 클라이언트가 `/api/v1/search/rag`에 질문과 `limit`를 보냅니다.
2. 백엔드는 의미 검색과 같은 방식으로 관련 청크를 찾습니다.
3. 결과가 없으면 `관련 문서를 찾지 못했습니다.`와 빈 인용 목록을 반환합니다.
4. 찾은 청크를 `[1]`, `[2]` 형식의 발췌문으로 묶습니다.
5. 발췌문은 generation 프롬프트에 최대 12,000자까지 들어갑니다.
6. generation 제공자는 제공된 발췌문만 근거로 한국어 답변을 만듭니다.
7. 응답은 `answer`와 `citations`입니다. `citations`에는 청크 ID, 문서 ID, 제목, 내용, score가 포함됩니다.

## 결과 표시

검색 API 결과는 청크 단위일 수 있지만, 프론트엔드 결과 그리드는 문서 단위로 중복 제거해 표시합니다. 검색 결과 개수 문구도 API chunk 개수가 아니라 화면에 렌더링되는 고유 문서 row 수를 기준으로 합니다.

RAG 답변 패널의 인용 수는 문서 row 수와 별개입니다. 인용 수는 답변에 사용된 citation/chunk 개수를 그대로 표시합니다.
