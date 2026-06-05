# 프론트엔드

Next.js 16 문서 아카이브 UI. 첫 화면: `ArchiveShell`.

## 실행

```bash
cd apps/frontend
npm install
npm run dev
```

- UI: `http://localhost:3000`
- 외부 접속: `npm run dev -- --hostname 0.0.0.0`

## 설정

- 기본 API: `/api/v1` same-origin 프록시 -> `127.0.0.1:8000`

```bash
NEXT_PUBLIC_BACKEND_API_URL=http://127.0.0.1:8000 npm run dev
```

## 구성

- `app/page.tsx`: `ArchiveShell` 렌더링.
- `components/archive-shell.tsx`: 화면 상태/동작.
- `lib/api.ts`: FastAPI 클라이언트.
- `components/ui/`: shadcn/Radix UI.

## 주요 기능

- 폴더 생성/이름 변경/삭제.
- 문서 업로드/선택/보기/다운로드/삭제.
- 키워드 검색과 의미 검색.
- 요약/초안/보고서/문체 변경/병합.
- 생성 문서 계보 일부 표시.
