# 프론트엔드 작업 지침

- Next.js 버전이 최신이므로 변경 전 현재 프로젝트 파일과 `package.json`을 확인합니다.
- API 호출은 `lib/api.ts`에 모읍니다.
- 주요 화면 변경은 `components/archive-shell.tsx`의 기존 상태 흐름을 따릅니다.
- 공통 UI는 `components/ui/`의 shadcn/Radix 컴포넌트를 우선 사용합니다.
- 개발 확인은 `npm run lint` 또는 필요한 경우 `npm run build`로 합니다.
