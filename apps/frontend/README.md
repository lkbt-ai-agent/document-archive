# 프론트엔드

Next.js 16 + React 19 + TypeScript 5 문서 아카이브 UI. 첫 화면: `ArchiveShell`.

## 실행

```bash
cd apps/frontend
npm install
npm run dev
```

- UI: `http://localhost:3000`

## 설정

- 기본 API: `/api/v1`.
- 기본 프록시: Next.js 16 -> `127.0.0.1:8000`.
- 프록시 이유: 브라우저에는 같은 origin만 노출하고, Next 서버가 백엔드로 전달해 CORS와 Tailscale 주소 차이를 줄임. (`127.0.0.1`: 같은 머신에서만 접속)
- API override:

```bash
NEXT_PUBLIC_BACKEND_API_URL=http://host:8000 npm run dev
```

## 검증

```bash
npm run lint
npm run build
```

## 구성

- `app/page.tsx`: `ArchiveShell` 렌더링.
- `components/archive-shell.tsx`: 화면 상태/동작.
- `lib/api.ts`: FastAPI 0.x 클라이언트.
- `components/ui/`: shadcn 4/radix-ui 1 UI.
- `AGENTS.md`: 프론트엔드 작업 지침.

## 주요 기능

- 폴더 생성/이름 변경/삭제.
- 문서 업로드/선택/보기/다운로드/삭제.
- 키워드 검색과 의미 검색.
- 요약/초안/보고서/문체 변경/병합.
- 생성 문서 계보 일부 표시.
