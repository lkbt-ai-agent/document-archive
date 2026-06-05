# 검색 필터 확장 TODO

## 반영한 TODO 결론

- 검색 결과 개수 표시는 API chunk 개수(`searchResults.length`)가 아니라 화면에 실제 렌더링하는 고유 문서 row 개수를 기준으로 재정의한다.
- 문서 유형, 태그, 날짜, 상태 같은 사용자가 조작하는 상세 필터는 1차 구현에서 키워드 검색에만 적용한다.
- 의미 검색과 RAG 검색은 유사도 후보군을 필터로 과도하게 줄이면 관련 문서가 검색 전에 사라질 수 있으므로, 폴더/루트/ready/embedding 존재 같은 필수 범위 조건만 유지한다.

## 조사 요약

- Pinecone은 vector search에서 metadata filtering이 필요하지만 pre-filtering, post-filtering, single-stage filtering 각각 정확도와 성능 trade-off가 있다고 설명한다. 특히 post-filtering은 검색 후 결과를 버리기 때문에 최종 top-k가 부족해질 수 있다.
  - 출처: https://www.pinecone.io/learn/vector-search-filtering/
- Weaviate는 filtered vector search에서 검색 결과가 필터 조건과 겹치도록 pre-filtering을 사용한다고 설명한다. 즉 vector/RAG 필터 자체는 일반적인 기능이다.
  - 출처: https://docs.weaviate.io/weaviate/concepts/search
- RAG 운영 글과 커뮤니티 사례에서는 metadata filter가 올바른 문서를 retrieval 전에 제외할 수 있고, post-retrieval filtering은 top-k starvation 위험이 있다고 지적한다.
  - 출처: https://optyxstack.com/rag-reliability/metadata-filters-in-rag-why-good-documents-disappear-before-retrieval-starts
  - 출처: https://www.reddit.com/r/Rag/comments/1q03kvu/rag_in_production_how_do_you_prevent_the_wrong/

## 최종 판단

vector/RAG 검색에 metadata filter를 붙이는 것 자체는 알려진 패턴이다. 다만 이 프로젝트의 현재 구현은 pgvector cosine distance 기반 단순 top-k이고, reranker나 filtered ANN 전용 최적화가 없다. 따라서 1차 구현에서 사용자가 조작하는 상세 필터를 semantic/RAG에 바로 섞으면 유사도 품질을 해치거나 관련 문서를 후보군에서 먼저 제거할 가능성이 있다.

결론: 1차 구현은 상세 검색 필터를 키워드 검색에만 적용한다. semantic/RAG는 현재 선택 폴더, 루트 여부, 처리 완료 상태, 임베딩 존재 여부 같은 필수 검색 범위만 유지한다. semantic/RAG 상세 필터는 별도 “제한 검색” 모드나 reranker 도입 후 2차로 검토한다.

## 범위

1차 구현 범위:

- 키워드 검색에 문서 유형, 태그, 생성일 범위, 처리 상태 필터를 추가한다.
- 의미 검색과 RAG 검색에는 상세 필터 UI/payload를 적용하지 않는다.
- 검색 결과 개수 표시를 실제 렌더링되는 고유 문서 row 개수와 일치시킨다.

범위 제외:

- semantic/RAG 상세 metadata filter.
- reranker.
- full-text search 전환.
- 검색 필터 옵션 전용 API.

## 현재 상태

### 백엔드

- `apps/backend/app/api/v1/search.py`
  - `keyword`, `semantic`, `rag` 엔드포인트가 있다.
  - keyword와 semantic은 `DocumentChunk` 기준 결과를 반환한다.
  - 같은 문서의 여러 chunk가 검색되면 API 결과 개수와 화면 row 개수가 달라질 수 있다.
- `apps/backend/app/api/v1/schemas.py`
  - `KeywordSearchRequest`, `SemanticSearchRequest`, `RagSearchRequest`가 각각 `query`, `folder_id`, `root_only`, `limit`만 받는다.
- 필터 가능 데이터
  - `Document.processing_status`
  - `Document.created_at`, `Document.updated_at`
  - `Document.mime_type`, `Document.source_type`, `Document.is_generated`
  - `DocumentMetadata.document_type`
  - `DocumentMetadata.tags`

### 프론트엔드

- `apps/frontend/components/archive-shell.tsx`
  - 검색 결과 표시는 `searchResults.length`를 사용한다.
  - 실제 렌더링 row는 `uniqueDocuments(rows)`를 사용한다.
  - 같은 문서에서 여러 chunk가 검색되면 “5개 표시 중”이라고 나오지만 화면에는 고유 문서 2개만 보일 수 있다.
- `apps/frontend/lib/api.ts`
  - 검색 API wrapper는 필터 payload를 받지 않는다.

## 검색 결과 개수 재정의

### 원칙

- 화면에 표시하는 검색 결과 개수는 “검색된 chunk 수”가 아니라 “렌더링되는 고유 문서 row 수”다.
- RAG 답변의 citation 개수와 문서 row 개수는 다른 개념이므로 분리해서 표시한다.
- 사용자가 보는 목록이 문서 row 목록이라면 count도 문서 row 기준이어야 한다.

### 프론트엔드 구현 계획

- 파일: `apps/frontend/components/archive-shell.tsx`
- 현재 ContentPane 내부에는 다음 값들이 있다.
  - `rows`
  - `uniqueRows`
  - `searchResults`
  - `ragResponse`
- `검색 지우기` 문구를 `searchResults.length` 대신 `uniqueRows.length` 기준으로 바꾼다.
- 표시 문구 예:
  - 키워드: `키워드 검색 결과 문서 2개 표시 중. 검색 지우기`
  - 의미: `의미 검색 결과 문서 2개 표시 중. 검색 지우기`
  - RAG: `RAG 답변 인용 문서 2개 표시 중. 검색 지우기`
- RAG 답변 패널 내부의 인용 수는 기존처럼 citation/chunk 수를 유지한다.
  - 예: `인용 5개`
  - 이유: RAG citation은 문서 row가 아니라 chunk citation이다.

### 선택 사항

- 필요하면 검색 상태에 chunk count도 함께 표시할 수 있다.
  - 예: `문서 2개, 조각 5개`
- 1차 구현에서는 혼란을 줄이기 위해 문서 row count만 표시한다.

## 키워드 검색 필터 계약

### 요청 payload

`KeywordSearchRequest`에만 상세 필터를 추가한다.

```py
class KeywordSearchRequest(BaseModel):
    query: str = Field(min_length=1)
    folder_id: uuid.UUID | None = None
    root_only: bool = False
    include_descendants: bool = False
    limit: int = Field(default=25, ge=1, le=100)
    document_types: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    created_from: datetime | None = None
    created_to: datetime | None = None
    processing_statuses: list[ProcessingStatus] = Field(default_factory=list)
```

`SemanticSearchRequest`, `RagSearchRequest`는 1차에서 기존 계약을 유지한다.

```py
class SemanticSearchRequest(BaseModel):
    query: str = Field(min_length=1)
    folder_id: uuid.UUID | None = None
    root_only: bool = False
    limit: int = Field(default=25, ge=1, le=50)
```

### 처리 상태 기본값

- `processing_statuses`가 비어 있으면 기존처럼 `ready`만 검색한다.
- 사용자가 상태 필터를 지정하면 해당 상태를 적용한다.
- 단, 키워드 검색 결과 row로 보여줄 수 없는 처리 중 문서 chunk가 없을 수 있으므로, UI 기본값은 `ready`로 둔다.

### 날짜 범위 규칙

- `created_from`, `created_to`는 `Document.created_at` 기준.
- `created_from`은 `>=`, `created_to`는 `<=`로 처리한다.
- 프론트엔드는 날짜 input 값을 ISO datetime으로 변환해 보낸다.
  - from: 선택일 `00:00:00`
  - to: 선택일 `23:59:59.999`

### 태그 규칙

- `DocumentMetadata.tags`는 JSONB list다.
- `tags` 필터는 AND 조건으로 처리한다.
  - 예: `["계약", "청구"]`이면 두 태그를 모두 가진 문서만 검색.
- 추후 OR 모드가 필요하면 `tag_match: "all" | "any"`를 별도 추가한다.

### 문서 유형 규칙

- `document_types`는 `DocumentMetadata.document_type` 값을 대상으로 한다.
- 빈 배열이면 필터 없음.
- 메타데이터가 없는 문서는 document type 필터를 통과하지 않는다.

## 백엔드 구현 계획

### 1. 스키마 수정

- 파일: `apps/backend/app/api/v1/schemas.py`
- `KeywordSearchRequest`에 상세 필터 필드를 추가한다.
- `SemanticSearchRequest`, `RagSearchRequest`는 상세 필터 필드를 추가하지 않는다.
- `ProcessingStatus` enum을 schema에서 타입으로 직접 쓰기 부담스러우면 `list[str]`로 받고 search layer에서 enum 값으로 검증한다.

### 2. keyword 전용 SQL 필터 helper 추가

- 파일: `apps/backend/app/api/v1/search.py`
- `_apply_keyword_filters(stmt, payload, db)` helper를 만든다.
- helper 책임:
  - `root_only`와 `folder_id` 조건 적용.
  - `include_descendants`가 true면 하위 폴더 id까지 계산해 `Document.folder_id.in_(...)` 적용.
  - `processing_statuses`가 있으면 해당 상태 적용, 없으면 `ready` 적용.
  - `created_from`, `created_to` 적용.
  - metadata 필터가 있으면 `DocumentMetadata` join을 추가하고 `document_type`, `tags` 조건 적용.

### 3. 하위 폴더 포함 helper 추가

- 파일: `apps/backend/app/api/v1/search.py`
- `_folder_ids_with_descendants(db, folder_id)` helper를 만든다.
- 구현:
  - 전체 `Folder` id/parent_id를 조회한다.
  - 메모리에서 BFS/DFS로 하위 id를 수집한다.
  - `include_descendants=false`면 기존처럼 현재 폴더만 검색한다.

### 4. keyword 검색에만 필터 적용

- `keyword_search`의 stmt에 `_apply_keyword_filters`를 적용한다.
- `DocumentChunk.content.ilike(f"%{payload.query}%")` 조건은 유지한다.
- metadata 필터가 없으면 `DocumentMetadata` join을 하지 않는다.
- 정렬은 1차에서 기존 순서를 유지한다.

### 5. semantic/RAG 검색은 필수 범위 조건만 유지

- `_semantic_search_results`는 기존 조건을 유지한다.
  - `Document.processing_status == ProcessingStatus.ready`
  - `DocumentChunk.embedding.is_not(None)`
  - `folder_id`/`root_only`
  - `limit`
- 상세 필터 적용은 하지 않는다.

## 프론트엔드 구현 계획

### 1. API 타입 추가

- 파일: `apps/frontend/lib/api.ts`
- `KeywordSearchFilters` 타입을 추가한다.

```ts
export type KeywordSearchFilters = {
  document_types?: string[];
  tags?: string[];
  created_from?: string | null;
  created_to?: string | null;
  processing_statuses?: string[];
  include_descendants?: boolean;
};
```

- `keywordSearch(query, folderId, filters?)`만 filters를 받도록 변경한다.
- `semanticSearch`, `ragSearch`는 기존 signature를 유지한다.

### 2. 필터 state 추가

- 파일: `apps/frontend/components/archive-shell.tsx`
- 키워드 검색용 필터 state를 추가한다.

```ts
type KeywordSearchFilterState = {
  documentTypes: string[];
  tags: string[];
  createdFrom: string;
  createdTo: string;
  processingStatuses: string[];
  includeDescendants: boolean;
};
```

- 기본값:
  - `documentTypes: []`
  - `tags: []`
  - `createdFrom: ""`
  - `createdTo: ""`
  - `processingStatuses: ["ready"]`
  - `includeDescendants: false`

### 3. 검색 실행 분기 수정

- `runSearch(mode)`에서 mode가 `keyword`일 때만 filters payload를 만든다.
- `semantic`과 `rag`는 filters를 보내지 않는다.
- 필터가 설정되어 있어도 semantic/RAG 메뉴를 누르면 상세 필터가 적용되지 않음을 UI에서 드러낸다.
  - 예: 필터 메뉴 설명에 `상세 필터는 키워드 검색에만 적용됩니다.`

### 4. 필터 UI 추가

- 검색 input 옆에 `Filter` icon button을 추가한다.
- UI 문구는 “키워드 필터”로 명명한다.
- 버튼 표시:
  - 필터 미적용: `Filter` 아이콘만.
  - 필터 적용: `Filter` 아이콘 + 작은 count badge.
- 메뉴 구성:
  - 하위 폴더 포함 checkbox.
  - 처리 상태 checkbox group.
    - 준비됨 `ready`
    - 처리 중 `processing`
    - 실패 `failed`
  - 문서 유형 checkbox group.
    - 옵션은 현재 `documents`와 `searchDocuments`의 `metadata_row.document_type`에서 unique 추출.
  - 태그 checkbox group.
    - 옵션은 현재 `documents`와 `searchDocuments`의 `metadata_row.tags`에서 unique 추출.
  - 생성일 from/to date input.
  - 하단 버튼:
    - `초기화`
    - `적용`
- 메뉴 하단에 짧은 안내를 둔다.
  - `키워드 검색에만 적용됩니다.`

### 5. 필터 적용 흐름

- 필터 메뉴 안에서 옵션을 바꿔도 즉시 검색하지 않는다.
- `적용`을 누르면:
  - query가 있고 현재 `searchMode === "keyword"`면 키워드 검색을 재실행한다.
  - query가 있고 현재 `searchMode`가 semantic/RAG면 검색 결과는 유지하지 말고 지운다.
  - query가 없으면 필터 상태만 저장하고 결과는 그대로 비운다.
- `초기화`를 누르면 기본 필터 state로 되돌린다.

### 6. 검색 결과 개수 표시 수정

- ContentPane에서 `uniqueRows.length`를 검색 결과 표시 count로 사용한다.
- 기존 문구:
  - `{formatSearchMode(searchMode)} 결과 {searchResults.length}개 표시 중. 검색 지우기`
- 변경 문구:
  - `{formatSearchMode(searchMode)} 결과 문서 {uniqueRows.length}개 표시 중. 검색 지우기`
- RAG 답변 패널의 citation count는 기존 `response.citations.length`를 유지한다.

### 7. 검색 지우기 정책

- 기존 `검색 지우기`는 query/result만 초기화한다.
- 키워드 필터는 유지한다.
- 필터 초기화는 필터 메뉴 안의 `초기화`에서만 수행한다.

## 인덱스 및 성능 계획

### 관계형 인덱스

- 이미 고려 중인 인덱스:
  - `documents(folder_id)`
  - `documents(processing_status)`
  - `documents(created_at)`
- 추가 검토:
  - `document_metadata(document_type)`
  - `document_metadata.tags` JSONB GIN index
- 별도 마이그레이션 계획은 `plan/low/database_index_todos.md`와 맞춘다.

### 검색 쿼리 성능

- keyword 검색은 현재 `ilike "%query%"`라 대용량에서 느려질 수 있다.
- 이번 TODO는 상세 필터와 count 표시 정합성을 다루며, full-text search 전환은 별도 TODO로 둔다.

## 구현 순서

1. 검색 결과 count 표시를 `uniqueRows.length` 기준으로 수정한다.
2. 백엔드 `KeywordSearchRequest`에 상세 필터 필드를 추가한다.
3. `search.py`에 keyword 전용 필터 helper와 하위 폴더 helper를 추가한다.
4. keyword 검색에만 필터 helper를 적용한다.
5. 프론트엔드 `api.ts`에 `KeywordSearchFilters`를 추가한다.
6. `archive-shell.tsx`에 키워드 필터 state와 payload 변환 helper를 추가한다.
7. 검색 헤더에 키워드 필터 UI를 추가한다.
8. semantic/RAG에는 상세 필터가 적용되지 않는다는 UI 안내를 추가한다.
9. lint 및 백엔드 문법 확인.

## 테스트 계획

- 결과 count 확인:
  - 같은 문서의 여러 chunk가 검색되는 키워드 검색에서 화면 row 수와 표시 count가 일치해야 한다.
  - semantic/RAG도 문서 row 수 기준으로 count가 표시되어야 한다.
- 키워드 필터 확인:
  - 키워드 검색 + 문서 유형 필터.
  - 키워드 검색 + 태그 필터.
  - 키워드 검색 + 생성일 필터.
  - 키워드 검색 + 처리 상태 필터.
  - 키워드 검색 + 하위 폴더 포함.
- semantic/RAG 확인:
  - 키워드 필터가 설정되어 있어도 semantic/RAG 검색에는 상세 필터가 적용되지 않아야 한다.
  - semantic/RAG는 기존 유사도 기반 결과를 유지해야 한다.
- 정적 검증:
  - `cd apps/frontend && npm run lint`
  - `python3 -m compileall apps/backend/app/api/v1/search.py apps/backend/app/api/v1/schemas.py`

## 완료 기준

- 검색 결과 count와 실제 렌더링 문서 row 수가 일치한다.
- 상세 필터는 키워드 검색에만 적용된다.
- semantic/RAG 검색은 폴더/루트/ready/embedding 존재 조건 외 상세 metadata filter를 적용하지 않는다.
- 필터 UI에 “키워드 검색에만 적용” 전제가 드러난다.
- 검색 지우기와 필터 초기화 동작이 분리된다.
