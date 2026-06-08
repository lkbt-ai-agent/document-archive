# 프론트엔드 Component

프론트엔드 컴포넌트는 React 19, shadcn 4, radix-ui 1, Tailwind CSS 4, lucide-react 1을 기준으로 합니다.

## Dialog 성능 원칙

- shadcn 4/radix-ui 1 Dialog는 복잡한 화면에서 `backdrop-filter`, 전체 화면 overlay, open/close animation이 repaint 비용을 만들 수 있으므로 기본 경로를 가볍게 유지한다.
- 공통 `DialogContent`는 fade/zoom/duration animation 클래스를 사용하지 않는다.
- `DialogOverlay`는 필요 시 `fixed inset-0 z-50 bg-black/40`만 사용하는 전제로 둔다.
