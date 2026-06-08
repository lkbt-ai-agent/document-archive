# PDF 업로드 흐름

PDF 업로드는 원본 저장과 문서 레코드 생성 후, FastAPI 0.x `BackgroundTasks`에서 처리됩니다. 업로드 API는 처리 완료를 기다리지 않고 `processing` 상태 문서를 먼저 반환합니다.

## 구현 대조 결과

- 기존 문서의 "동기 처리" 설명은 현재 코드와 다릅니다.
- 프론트엔드는 완료를 즉시 알 수 없으므로 3초 간격으로 문서 상태를 폴링합니다.
- `POST /api/v1/documents/upload`는 성공 시 `201`과 문서 레코드를 반환합니다.
- 재처리 API는 아직 `409`를 반환하지만, 오류 문구의 "synchronously" 표현은 현재 구현과 맞지 않습니다.

## 흐름

1. 사용자가 업로드 버튼을 누르고 PDF를 선택합니다.
2. 프론트엔드는 `FormData`에 `file`을 넣고, 폴더가 선택되어 있으면 `folder_id`도 넣습니다.
3. `POST /api/v1/documents/upload`를 호출합니다.
4. 백엔드는 확장자가 지원 목록인지 확인합니다. 지원 확장자는 `.jpg`, `.jpeg`, `.png`, `.webp`, `.pdf`, `.txt`, `.md`입니다.
5. 업로드 파일 전체를 메모리로 읽습니다.
6. 폴더 ID가 있으면 폴더 존재 여부를 확인합니다.
7. 원본 PDF를 로컬 디스크 또는 MinIO server 버전 확인 필요 저장소에 `documents/originals/{document_id}/{filename}`으로 저장합니다.
8. `Document`를 `processing` 상태로 만들고, 파일 크기와 SHA-256 체크섬, 저장 위치를 기록합니다.
9. DB 커밋 후 `BackgroundTasks`에 실제 처리를 등록합니다.
10. API는 `201`과 `processing` 상태 문서를 반환합니다.
11. 백그라운드 작업은 문서를 다시 읽고 `processing_error`를 초기화합니다.
12. `pypdf.PdfReader`로 페이지 텍스트를 추출합니다. 기준 라이브러리는 pypdf 5입니다.
13. generation 제공자로 제목, 요약, 태그, 언어, 문서 유형, 인물, 조직, 주요 날짜를 생성합니다.
14. 파일명을 제목 기반 `corrected_filename`으로 보정합니다.
15. 텍스트를 360자 단위, 60자 overlap으로 청킹합니다.
16. embedding 제공자로 청크 임베딩을 만듭니다.
17. `DocumentMetadata`와 `DocumentChunk`를 저장합니다.
18. 성공하면 문서를 `ready`로 바꾸고 `upload_elapsed_seconds`를 기록합니다.
19. 프론트엔드는 처리 중 문서가 있으면 3초 간격으로 목록과 개별 문서 상태를 갱신합니다.
20. 문서가 `ready`가 되면 완료 토스트를 표시합니다.

## 실패

- 확장자가 지원 목록에 없으면 업로드 API가 `415`를 반환합니다.
- 폴더 ID가 없으면 루트에 저장합니다.
- 폴더 ID가 존재하지 않으면 업로드 API가 `404`를 반환합니다.
- 원본 저장이나 레코드 생성이 실패하면 업로드 API가 실패합니다.
- 백그라운드 추출, 메타데이터 생성, 임베딩 중 오류가 나면 문서는 `failed`가 되고 `processing_error`와 `upload_elapsed_seconds`가 저장됩니다.
- 백그라운드 실패는 이미 반환된 업로드 API 응답을 바꾸지 않습니다. 프론트엔드는 폴링으로 실패 상태를 확인합니다.

## 제한

- 스캔 PDF OCR fallback은 없습니다.
- PDF 추출은 `pypdf 5` 텍스트 레이어만 사용합니다.
- 재처리 API는 있지만 현재 `409`를 반환합니다.
- 별도 큐/워커는 없습니다. FastAPI 0.x `BackgroundTasks`만 사용합니다.
- 검색 필터는 폴더와 루트 여부만 지원합니다.
