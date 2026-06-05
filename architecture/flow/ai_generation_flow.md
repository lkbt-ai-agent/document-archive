# AI 생성 문서 흐름

## 흐름

1. 클라이언트가 `/api/v1/ai-actions/*` 엔드포인트에 작업, 프롬프트, 출처 문서 ID, 폴더 ID를 보냅니다.
2. 백엔드는 먼저 빈 생성 문서 레코드를 만들고 `pending` 상태로 응답합니다.
3. 실제 생성은 FastAPI `BackgroundTasks`에서 처리합니다.
4. 출처 문서의 청크를 읽고, 프롬프트 단어와 작업별 중요 단어로 관련 청크를 우선 선택합니다.
5. 작업별 기본 입력 한도는 요약 8,000자, 초안/문체 변경 10,000자, 보고서/병합 12,000자입니다.
6. context 초과 오류가 나면 출처 글자 수와 `max_tokens`를 줄여 재시도합니다.
7. generation 제공자가 Markdown 본문을 생성합니다.
8. 별도 제목 생성 요청으로 60자 이하 제목을 만들고, 실패하면 fallback 제목을 씁니다.
9. 생성 Markdown은 `documents/generated/{document_id}/{filename}`에 저장합니다.
10. 생성 문서도 메타데이터 생성, 360자 청킹, 임베딩을 수행합니다.
11. 성공 시 `ready`, 실패 시 `failed`와 오류 메시지를 기록합니다.
12. `generated_document_lineage`에 출처 문서 ID, 선택 청크 ID, 작업, 프롬프트, 모델, 파라미터를 저장합니다.
