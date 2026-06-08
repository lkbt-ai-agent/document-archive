# AI와 RAG

AI 호출은 `apps/backend/app/ai/providers.py`의 제공자 인터페이스와 `llama_cpp_provider.py` 구현을 거칩니다. llama.cpp 서버는 OpenAI 호환 엔드포인트를 사용합니다.

## 제공자

- OCR: 이미지 파일에서 텍스트 추출.
- Embedding: 문서 청크와 검색어 임베딩.
- Text generation: 메타데이터 생성, 요약, 초안, 보고서, 문체 변경, 병합.

설정은 `config/ai_providers.json`과 `.env.local-ai`에서 읽습니다. 모델 파일이 없거나 서버 URL이 없으면 모의 응답 없이 오류를 냅니다.

## 업로드 처리

```text
file upload
  -> local/MinIO 저장
  -> Document processing 반환
  -> BackgroundTasks
  -> PDF/text/image 텍스트 추출
  -> generation 제공자로 JSON 메타데이터 생성
  -> 360자 청크 생성
  -> embedding 제공자로 청크 임베딩
  -> Document ready 또는 failed
```

PDF는 `pypdf` 텍스트 추출만 사용합니다. 스캔 PDF용 OCR fallback은 아직 없습니다.

## 검색

> Embedding: 텍스트를 의미가 비교 가능한 숫자 벡터로 바꾼 값.
> Cosine distance: 두 벡터의 방향 차이. 작을수록 의미가 가깝습니다.
> RAG: 검색한 문서 조각을 생성 모델 프롬프트에 넣어 답변하는 방식.

- 키워드 검색: `DocumentChunk.content ILIKE`.
- 의미 검색: 검색어 임베딩 후 pgvector 코사인 거리 정렬.
- RAG 검색: 의미 검색 청크를 generation 제공자에 전달해 답변과 인용을 반환.
- 키워드 검색 지원 필터: 파일 유형, 등록일 범위, 처리 상태, limit.
- 의미/RAG 검색 지원 필터: 필수 범위 조건과 limit. 헤더 검색에서는 선택 폴더를 보내지 않아 전체 폴더를 대상으로 합니다.

키워드 검색은 상세 필터를 지원하지만 의미 검색과 RAG는 상세 metadata filter를 적용하지 않습니다. 현재 검색은 pgvector 코사인 거리 기반 top-k이므로, metadata filter를 먼저 적용하면 관련 청크가 retrieval 전에 제외될 수 있습니다.

상세 단계는 [검색과 RAG 흐름](flow/search_rag_flow.md)을 봅니다.

## 생성 문서

> Context: 모델에 한 번에 전달하는 지시문, 사용자 요청, 출처 텍스트 범위.
> Lineage: 생성 문서가 어떤 문서, 청크, 프롬프트, 모델에서 나왔는지 남긴 기록.

AI 작업은 선택한 출처 문서의 청크 텍스트를 작업별 한도 안에서 프롬프트에 넣습니다. 결과는 Markdown 문서로 저장하고 청킹/임베딩합니다.

지원 작업:

- 요약
- 초안 작성
- 보고서 작성
- 문체 변경
- 문서 병합

상세 단계는 [AI 생성 문서 흐름](flow/ai_generation_flow.md)을 봅니다.

## RAG 답변

`POST /api/v1/search/rag`는 구현되어 있습니다. 질문을 임베딩하고 관련 청크를 찾은 뒤, 제공된 청크만 근거로 한국어 답변을 생성합니다. 응답에는 답변과 인용 청크 목록이 포함됩니다.

프론트엔드는 검색 메뉴의 `RAG 답변` 모드로 이 API를 호출하고, 답변, 인용 수, 소요 시간, 인용 청크를 표시합니다.
