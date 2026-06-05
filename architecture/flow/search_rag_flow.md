# 검색과 RAG 흐름

## 의미 검색

1. 클라이언트가 `/api/v1/search/semantic`에 질문, `limit`, 폴더 필터를 보냅니다.
2. 백엔드가 embedding 제공자에 질문 1개를 보내 벡터를 받습니다.
3. `processing_status=ready`이고 `embedding IS NOT NULL`인 청크만 조회합니다.
4. pgvector `cosine_distance()`로 질문 벡터와 청크 벡터를 비교합니다.
5. 거리가 작은 순서로 `limit`개를 반환합니다.
6. 응답 score는 `1 - distance`입니다.

## RAG 검색

1. 클라이언트가 `/api/v1/search/rag`에 질문과 필터를 보냅니다.
2. 백엔드는 의미 검색과 같은 방식으로 관련 청크를 찾습니다.
3. 결과가 없으면 `관련 문서를 찾지 못했습니다.`와 빈 인용 목록을 반환합니다.
4. 찾은 청크를 `[1]`, `[2]` 형식의 발췌문으로 묶습니다.
5. 발췌문은 generation 프롬프트에 최대 12,000자까지 들어갑니다.
6. generation 제공자는 제공된 발췌문만 근거로 한국어 답변을 만듭니다.
7. 응답은 `answer`와 `citations`입니다. `citations`에는 청크 ID, 문서 ID, 제목, 내용, score가 포함됩니다.
