# PDF 업로드 흐름

PDF 업로드는 현재 백엔드 요청 안에서 동기적으로 처리됩니다.

## 흐름

1. 사용자가 업로드 버튼을 누르고 PDF를 선택합니다.
2. 프론트엔드는 `FormData`에 `file`을 넣고, 폴더가 선택되어 있으면 `folder_id`도 넣습니다.
3. `POST /api/v1/documents/upload`를 호출합니다.
4. 백엔드는 확장자가 지원 목록에 있는지 확인합니다.
5. 원본 PDF를 로컬 디스크 또는 MinIO에 저장합니다.
6. `Document`를 `processing` 상태로 만듭니다.
7. `pypdf.PdfReader`로 페이지 텍스트를 추출합니다.
8. generation 제공자로 제목, 요약, 태그, 언어, 문서 유형, 인물, 조직, 주요 날짜를 생성합니다.
9. 파일명을 제목 기반 `corrected_filename`으로 보정합니다.
10. 텍스트를 360자 단위, 60자 overlap으로 청킹합니다.
11. embedding 제공자로 청크 임베딩을 만듭니다.
12. `DocumentMetadata`와 `DocumentChunk`를 저장합니다.
13. 성공하면 문서를 `ready`로 바꾸고 프론트엔드가 목록을 새로고침합니다.

## 실패

추출, 메타데이터 생성, 임베딩 중 오류가 나면 문서는 `failed`가 되고 `processing_error`에 원인이 저장됩니다. 업로드 요청도 오류로 끝납니다.

## 제한

- 스캔 PDF OCR fallback은 없습니다.
- 재처리 API는 있지만 현재 `409`를 반환합니다.
- 백그라운드 큐는 없습니다.
- RAG 답변 API는 있지만 프론트엔드 답변 화면은 아직 없습니다.
- 검색 필터는 폴더와 루트 여부만 지원합니다.
