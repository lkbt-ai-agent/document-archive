# 텍스트 원본 보기 Markdown 뷰어 UI 계획

## 대상 TODO

`plan/todos.md` high 2: 텍스트 확장자 문서는 "원본 보기" 버튼 클릭 시, 마크다운 뷰어 UI를 제공해야 한다.

## 배경

현재 업로드 지원 확장자는 `.jpg`, `.jpeg`, `.png`, `.webp`, `.pdf`, `.txt`, `.md`입니다. 백엔드는 원본 보기 API를 제공합니다.

- `GET /api/v1/documents/{document_id}/view`: 원본 파일 inline 보기.
- `GET /api/v1/documents/{document_id}/download`: 원본 파일 다운로드.

프론트엔드는 문서 행 메뉴, 우클릭 메뉴, 메타데이터 사이드바의 "원본 보기"에서 `api.viewUrl(document.id)`를 새 브라우저 탭으로 엽니다.

현재 문제:

- 텍스트/Markdown 문서도 브라우저 기본 텍스트 렌더링에 맡겨져 앱 UI 컨텍스트가 끊깁니다.
- Markdown 문서는 실제 문서처럼 보기 어렵고, 생성 문서(`text/markdown`)의 사용성이 낮습니다.
- 원본 보기와 다운로드가 같은 메뉴에 있지만 텍스트 문서에서는 "보기"가 앱 내부 기능처럼 동작하지 않습니다.

## 목표

- `.md`, `.markdown`, `text/markdown` 문서는 "원본 보기" 클릭 시 앱 내부 Markdown 뷰어 UI로 표시합니다.
- `.txt`, `text/plain` 문서는 같은 뷰어 컨테이너에서 plain text로 표시합니다.
- PDF와 이미지는 기존처럼 새 탭 원본 보기 동작을 유지합니다.
- 다운로드 기능은 기존 URL과 동작을 유지합니다.
- 뷰어는 문서 목록/메타데이터 패널의 현재 맥락을 해치지 않고 빠르게 열리고 닫혀야 합니다.

## 비목표

- 이 단계에서 Markdown 편집 기능은 만들지 않습니다.
- 복잡한 WYSIWYG 에디터, 공동 편집, 주석 기능은 다루지 않습니다.
- 백엔드 추출 청크 뷰어(`/content`)와 원본 파일 뷰어를 합치지 않습니다.
- Mermaid, 수식, HTML raw rendering은 기본 지원하지 않습니다. 보안과 의존성 검토 후 별도 작업으로 다룹니다.

## 현재 구현 흐름

### 백엔드

`apps/backend/app/api/v1/documents.py`

- `_view_media_type(document)`는 `text/*` MIME에 `charset=utf-8`을 붙입니다.
- `_original_file_response(document, download=False)`는 local storage면 `FileResponse`, MinIO면 presigned URL로 redirect합니다.
- 텍스트 원본 body를 JSON으로 반환하는 API는 없습니다.

### 프론트엔드

`apps/frontend/lib/api.ts`

- `api.viewUrl(documentId)`는 `/api/v1/documents/{id}/view` URL 문자열을 반환합니다.
- `api.downloadUrl(documentId)`도 URL 문자열을 반환합니다.

`apps/frontend/components/archive-shell.tsx`

- `DocumentResultRow`의 `onOpen`은 `window.open(api.viewUrl(document.id), "_blank", "noreferrer")`입니다.
- `ArchiveContextMenu`의 "원본 열기"도 새 탭을 엽니다.
- `OriginalFileMenu`의 "원본 보기"는 `<a href=... target="_blank">`입니다.

## UX 설계

### 진입점

다음 모든 "원본 보기/원본 열기" 진입점은 같은 분기 함수를 사용합니다.

- 문서 행 더보기 메뉴의 "원본 열기".
- 문서 우클릭 컨텍스트 메뉴의 "원본 열기".
- 메타데이터 사이드바 `OriginalFileMenu`의 "원본 보기".

분기:

- 텍스트/Markdown 문서: 앱 내부 뷰어 열기.
- PDF/이미지/기타 문서: 기존처럼 새 탭 열기.

### 뷰어 형태

권장 형태는 full-height에 가까운 `Dialog`입니다.

- 제목 영역: 문서 표시 이름, 원본 파일명, MIME/크기.
- 액션 영역: 다운로드, 새 탭으로 열기, 닫기.
- 본문 영역:
  - Markdown: 렌더링된 Markdown 탭과 원문 탭 제공.
  - Plain text: 원문 텍스트만 표시.
- 로딩 상태: skeleton 또는 짧은 로딩 텍스트.
- 오류 상태: 원본을 불러오지 못했을 때 재시도/새 탭 열기 제공.

Dialog는 기존 `architecture/frontend_component.md`의 성능 원칙을 따릅니다.

- 무거운 animation을 추가하지 않습니다.
- overlay는 기본 shadcn Dialog 정책을 따릅니다.
- 본문은 `ScrollArea`로 제한해 페이지 전체 layout shift를 막습니다.

### 탭 구성

Markdown 문서:

- `미리보기`: Markdown을 HTML/React로 렌더링.
- `원문`: fenced code처럼 고정폭 텍스트로 표시.

Plain text 문서:

- 탭 없이 원문만 표시하거나, 동일 컴포넌트에서 `원문` 단일 탭으로 표시합니다.

이 프로젝트의 UI 밀도를 고려하면 Markdown 문서에만 탭을 보이고, txt는 단순 원문 뷰가 적절합니다.

### Markdown 렌더링 범위

1차 지원:

- headings
- paragraphs
- ordered/unordered lists
- blockquote
- fenced code block
- inline code
- links
- tables
- horizontal rule
- strong/emphasis

1차 제외:

- raw HTML rendering
- Mermaid
- LaTeX/KaTeX
- iframe/embed
- 원격 이미지 자동 인라인 표시

보안 방침:

- Markdown raw HTML은 렌더링하지 않습니다.
- 링크는 새 탭으로 열고 `rel="noreferrer"`를 붙입니다.
- 이미지 렌더링은 우선 비활성화하거나, `src`가 data URL/상대 경로인 경우 정책을 정한 뒤 지원합니다.

## 기술 설계

### 파일 유형 판별

프론트에서 다음 유틸을 추가합니다.

```ts
function isTextOriginal(document: ArchiveDocument) {
  return document.mime_type.startsWith("text/")
    || /\.(txt|md|markdown)$/i.test(document.original_filename);
}

function isMarkdownOriginal(document: ArchiveDocument) {
  return document.mime_type === "text/markdown"
    || /\.(md|markdown)$/i.test(document.original_filename);
}
```

백엔드의 `SUPPORTED_EXTENSIONS`에는 현재 `.md`, `.txt`만 있으므로 `.markdown` 지원 여부는 별도로 결정합니다. 프론트 판별에는 `.markdown`을 포함하되 업로드 지원은 백엔드 변경 전까지 `.md`만 보장한다고 문서화합니다.

### API 클라이언트

`apps/frontend/lib/api.ts`에 텍스트 fetch 메서드를 추가합니다.

```ts
originalText: async (documentId: string) => {
  const response = await fetch(api.viewUrl(documentId));
  if (!response.ok) throw new Error(`원본을 불러오지 못했습니다: ${response.status}`);
  return response.text();
}
```

주의:

- 기존 `request<T>`는 JSON 응답을 전제로 하므로 사용하지 않습니다.
- MinIO 사용 시 `/view`가 307 redirect를 반환합니다. browser fetch는 기본적으로 redirect를 따르므로 같은 origin/CORS 조건을 확인해야 합니다.
- presigned URL이 다른 origin이면 MinIO CORS가 필요할 수 있습니다. 이 경우 백엔드 proxy endpoint를 별도로 만들지 검토합니다.

### 상태 관리

`ArchiveShell`에 뷰어 상태를 추가합니다.

```ts
type OriginalViewerState = {
  document: ArchiveDocument;
} | null;
```

추가 state:

- `originalViewer`
- `originalText`
- `originalTextLoading`
- `originalTextError`

또는 로딩 상태를 `OriginalTextViewerDialog` 내부로 캡슐화합니다. 단일 파일 컴포넌트가 이미 크므로, 구현 시에는 뷰어 컴포넌트를 같은 파일 하단에 두되 상태는 컴포넌트 내부로 두는 방식을 우선합니다.

권장:

- `ArchiveShell`은 `setOriginalViewer({ document })`만 관리합니다.
- `OriginalTextViewerDialog`가 `useEffect`로 `api.originalText(document.id)`를 호출합니다.

### 이벤트 흐름

공통 함수:

```ts
function openOriginal(document: ArchiveDocument) {
  if (isTextOriginal(document)) {
    setOriginalViewer({ document });
    return;
  }
  window.open(api.viewUrl(document.id), "_blank", "noreferrer");
}
```

적용 위치:

- `DocumentResultRow`에 넘기는 `onOpen`.
- `ArchiveContextMenu`에는 `onOpenDocument` prop을 추가해 직접 `window.open`하지 않게 합니다.
- `OriginalFileMenu`에는 `document` 전체 또는 `onViewOriginal` callback을 전달합니다.

### Markdown 라이브러리

현재 프론트 의존성에는 Markdown renderer가 없습니다.

후보:

- `react-markdown`
- `remark-gfm`

권장:

- `react-markdown` + `remark-gfm`을 추가합니다.
- raw HTML은 기본적으로 렌더링하지 않고, `rehype-raw`는 추가하지 않습니다.

설치:

```bash
npm --workspace apps/frontend install react-markdown remark-gfm
```

네트워크가 제한된 환경에서는 설치가 실패할 수 있으므로 승인 또는 사전 설치 여부 확인이 필요합니다.

대안:

- 라이브러리 추가 없이 plain text만 예쁘게 보여주고 Markdown 렌더링은 후속 작업으로 미룹니다.
- 하지만 TODO가 "마크다운 뷰어 UI"를 요구하므로 실제 Markdown 렌더링 라이브러리 도입이 더 적절합니다.

### 스타일링

별도 typography plugin 없이 Tailwind 클래스와 `react-markdown` component mapping을 사용합니다.

예:

- `h1`: `text-xl font-semibold`
- `h2`: `text-lg font-semibold`
- `p`: `text-sm leading-7`
- `ul`, `ol`: `list-disc/list-decimal pl-5`
- `code`: inline은 muted 배경, block은 `pre` 안에서 고정폭/가로 스크롤.
- `table`: `overflow-x-auto`, border 적용.

전역 CSS에 `.markdown-body`를 추가하는 방법도 가능하지만, 이 프로젝트는 컴포넌트 안에서 Tailwind class를 직접 쓰는 패턴이 강하므로 component mapping을 우선합니다.

## 백엔드 수정 필요 여부

1차 구현은 백엔드 변경 없이 가능합니다.

다만 다음 문제가 확인되면 백엔드 보강을 검토합니다.

### MinIO CORS 문제

프론트 fetch가 `/documents/{id}/view` 307 redirect를 따라 MinIO presigned URL을 요청할 때 CORS 문제가 날 수 있습니다.

대응안:

1. MinIO CORS 설정을 문서화합니다.
2. 텍스트 문서 전용 API를 추가합니다.

후보 API:

```http
GET /api/v1/documents/{document_id}/original-text
```

응답:

```json
{
  "document_id": "...",
  "filename": "generated.md",
  "mime_type": "text/markdown",
  "content": "# ..."
}
```

장점:

- 프론트가 JSON으로 안정적으로 받습니다.
- MinIO redirect/CORS 영향을 줄입니다.
- 텍스트 파일만 허용하고 크기 제한을 둘 수 있습니다.

단점:

- 백엔드가 MinIO 객체를 직접 읽는 기능이 필요합니다.
- 원본 바이너리 API와 중복 API가 생깁니다.

1차에서는 fetch redirect가 동작하는지 확인하고, 실패할 경우 `original-text` API를 도입합니다.

### 파일 크기 제한

큰 텍스트 파일을 한 번에 렌더링하면 UI가 느려질 수 있습니다.

권장 정책:

- 1차: 2MB 이하 텍스트는 앱 내부 렌더링, 초과 시 새 탭 열기와 다운로드만 제공.
- 기준은 프론트에서 `document.file_size`로 먼저 판단합니다.
- 추후 backend endpoint가 생기면 서버에서도 제한합니다.

## 구현 작업

### 1. 의존성 추가

```bash
npm --workspace apps/frontend install react-markdown remark-gfm
```

수정 파일:

- `apps/frontend/package.json`
- `apps/frontend/package-lock.json`

### 2. API 클라이언트 확장

`apps/frontend/lib/api.ts`

- `api.originalText(documentId)` 추가.
- JSON 전용 `request<T>`를 재사용하지 않고 `fetch` 직접 사용.
- 네트워크 오류는 `ApiNetworkError`와 유사한 메시지로 감쌉니다.

### 3. 문서 유형 유틸 추가

`apps/frontend/components/archive-shell.tsx`

- `isTextOriginal(document)`
- `isMarkdownOriginal(document)`
- 필요 시 `canUseInternalOriginalViewer(document)`.

기준:

- `text/plain`, `text/markdown`, `text/*`
- 파일명 `.txt`, `.md`, `.markdown`
- 크기 제한 초과 시 내부 뷰어 제외

### 4. 공통 원본 열기 함수 도입

`ArchiveShell` 내부:

- `originalViewer` state 추가.
- `openOriginal(document)` 함수 추가.
- 기존 `window.open(api.viewUrl(...))` 호출을 `openOriginal(document)`로 교체.

prop 변경:

- `ArchiveWorkspace`에 `onOpenOriginal(document)` 전달.
- `ArchiveContextMenu`에 `onOpenDocument(document)` 전달.
- `MetadataSidebar` 또는 `OriginalFileMenu`에 `onViewOriginal` 전달.

주의:

- `ArchiveContextMenu`가 현재 직접 `window.open`을 호출하므로 callback 기반으로 바꿔야 합니다.
- `OriginalFileMenu`는 현재 `documentId`만 받으므로 텍스트 판별을 위해 `ArchiveDocument` 전체를 받도록 바꿉니다.

### 5. `OriginalTextViewerDialog` 컴포넌트 추가

역할:

- open 상태와 대상 문서를 받습니다.
- 열릴 때 원본 텍스트를 fetch합니다.
- Markdown이면 preview/source 전환 UI를 제공합니다.
- txt면 source view만 제공합니다.
- 다운로드와 새 탭 열기를 제공합니다.

상태:

- `content: string`
- `loading: boolean`
- `error: string | null`
- `mode: "preview" | "source"`

구성:

- `Dialog`
- `DialogHeader`
- `ScrollArea`
- `Button`
- `Badge`

### 6. Markdown renderer 구현

`react-markdown`과 `remark-gfm` 사용:

```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
        {children}
      </a>
    ),
  }}
>
  {content}
</ReactMarkdown>
```

보안:

- `rehypeRaw`를 사용하지 않습니다.
- `img`는 1차에서 렌더링하지 않거나 링크 형태로 대체합니다.

### 7. 오류/경계 상태 처리

처리할 상태:

- fetch 실패.
- 404 문서 없음.
- MinIO CORS/redirect 실패.
- 텍스트 파일 크기 제한 초과.
- 빈 파일.
- 처리 중 문서의 원본 보기.

정책:

- 처리 중이어도 원본은 저장되어 있으므로 원본 보기는 허용합니다.
- fetch 실패 시 "새 탭으로 열기"를 제공해 기존 경로로 우회합니다.
- 빈 파일은 빈 상태 메시지를 표시합니다.

### 8. 접근성 및 키보드

- Dialog title은 문서 표시 이름을 포함합니다.
- 닫기 버튼과 다운로드/새 탭 버튼에 명확한 aria-label을 둡니다.
- preview/source 전환은 `Button` 또는 작은 segmented control로 구현합니다.
- `Esc`로 닫히는 기본 Dialog 동작을 유지합니다.

## 수정 파일 후보

필수:

- `apps/frontend/lib/api.ts`
- `apps/frontend/components/archive-shell.tsx`
- `apps/frontend/package.json`
- `apps/frontend/package-lock.json`

조건부:

- `apps/backend/app/api/v1/documents.py`
- `apps/backend/app/api/v1/schemas.py`
- `architecture/backend_api.md`
- `architecture/frontend_logic.md`
- `architecture/frontend_component.md`

백엔드 조건부 수정은 MinIO CORS 또는 파일 크기 제한을 서버에서 처리해야 할 때만 진행합니다.

## 테스트 및 검증

### 단위/정적 검증

```bash
npm --workspace apps/frontend run lint
```

### 수동 UI 검증

사전 조건:

- 백엔드/프론트 dev server 실행.
- `.md`, `.txt`, `.pdf`, 이미지 문서 각각 업로드.

검증 항목:

- `.md` 문서 행 메뉴의 "원본 열기"를 누르면 앱 내부 Markdown 뷰어가 열립니다.
- `.md` 뷰어에서 미리보기와 원문을 전환할 수 있습니다.
- `.txt` 문서는 앱 내부에서 원문 텍스트가 열립니다.
- PDF/이미지는 기존처럼 새 탭에서 열립니다.
- 메타데이터 사이드바의 "원본 보기"도 같은 분기 정책을 따릅니다.
- 우클릭 컨텍스트 메뉴의 "원본 열기"도 같은 분기 정책을 따릅니다.
- 다운로드는 모든 문서 유형에서 기존처럼 동작합니다.
- fetch 실패 시 새 탭 열기 fallback이 보입니다.

### Playwright 검증 후보

프론트 기능이 안정화되면 다음 흐름을 자동화합니다.

- Markdown 샘플 업로드.
- 문서 행에서 원본 열기.
- Dialog title 확인.
- Markdown heading/list/code block 렌더링 확인.
- 원문 모드 전환 확인.
- 닫기 확인.

### 브라우저 호환 검증

- Chrome 계열에서 fetch redirect와 Markdown 렌더링 확인.
- Safari에서 Dialog scroll area와 긴 코드 블록 가로 스크롤 확인.

## 완료 기준

- 텍스트/Markdown 문서의 원본 보기 진입점이 앱 내부 뷰어를 사용합니다.
- PDF/이미지 원본 보기 동작은 회귀하지 않습니다.
- Markdown 미리보기는 raw HTML 없이 기본 Markdown 요소를 렌더링합니다.
- 원문 보기와 다운로드, 새 탭 열기 fallback이 제공됩니다.
- 프론트 lint가 통과합니다.
- MinIO 사용 시 fetch 문제가 있으면 backend proxy API 또는 MinIO CORS 문서화 중 하나가 적용됩니다.

## 리스크 및 대응

- Markdown 렌더러 의존성 추가가 번들 크기를 늘릴 수 있습니다.
  - 대응: 뷰어 컴포넌트를 dynamic import로 분리할지 후속 검토합니다. 1차는 단순 import로 구현합니다.
- raw HTML 렌더링을 요구하는 Markdown이 있을 수 있습니다.
  - 대응: 보안을 우선해 1차에서는 렌더링하지 않습니다.
- MinIO redirect 후 CORS 문제가 발생할 수 있습니다.
  - 대응: 텍스트 전용 backend proxy API를 도입합니다.
- 큰 Markdown 파일 렌더링이 느릴 수 있습니다.
  - 대응: 파일 크기 제한과 source-only fallback을 둡니다.
