# 프론트엔드

Next.js 16 기반 문서 아카이브 UI입니다. 첫 화면은 `ArchiveShell`이며 폴더, 문서, 검색, AI 작업을 한 화면에서 다룹니다.

## 실행

```bash
cd apps/frontend
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 설정

기본 백엔드 주소는 `/api/v1` same-origin 프록시입니다. `NEXT_PUBLIC_BACKEND_API_URL`을 지정하지 않으면 Next.js가 요청을 같은 머신의 `http://127.0.0.1:8000`으로 전달합니다.

```bash
NEXT_PUBLIC_BACKEND_API_URL=http://127.0.0.1:8000 npm run dev
```

Tailscale 예시:

```text
http://xxx-macmini.tail902fcf.ts.net:3000/
  -> http://xxx-macmini.tail902fcf.ts.net:3000/api/v1
  -> http://127.0.0.1:8000/api/v1
```

다른 기기에서 접속하려면 Next.js dev server를 모든 인터페이스에 바인딩합니다.

```bash
npm run dev -- --hostname 0.0.0.0
```

## 구성

- `app/page.tsx`: `ArchiveShell` 렌더링.
- `components/archive-shell.tsx`: 주요 화면 상태와 동작.
- `lib/api.ts`: FastAPI 클라이언트.
- `components/ui/`: shadcn/Radix 기반 UI 컴포넌트.

## 주요 기능

- 폴더 생성, 이름 변경, 삭제.
- 문서 업로드, 선택, 보기, 다운로드, 삭제.
- 키워드 검색과 의미 검색.
- 요약, 초안, 보고서, 문체 변경, 병합 요청.
- 생성 문서 계보 일부 표시.
