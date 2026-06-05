# 프론트엔드 로직

## 폴더 생성 상태 갱신

- 폴더 생성 성공 후에는 생성된 폴더로 자동 진입하지 않고 현재 `selectedFolderId`, `documents`, `selectedDocumentId`를 유지한다.
- 새 폴더는 `api.createFolder` 응답을 `mergeFolderIntoList`로 `folders` 상태에만 반영해 사이드바와 현재 하위 폴더 목록에 즉시 보여준다.
- 폴더 생성은 문서 목록이나 검색/RAG 결과를 바꾸는 작업이 아니므로 현재 위치의 문서 재조회는 하지 않는다.
