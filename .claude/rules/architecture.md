# 아키텍처 규칙

## 모노레포 구조

```
apps/web/          → Next.js 15 (UI + API)
packages/core/     → 비즈니스 로직 (분석, DB, 큐, 리포트)
packages/collectors/ → 데이터 수집기
packages/ai-gateway/ → AI 프로바이더 통합
```

## 의존성 방향 (단방향)

`web → core → collectors, ai-gateway`

- web은 core의 public API만 import (내부 경로 금지)
- core는 collectors, ai-gateway를 import 가능
- collectors와 ai-gateway는 서로 독립 (상호 참조 금지)

## 파일 크기 제한

- 컴포넌트: 300줄 이하 권장 (500줄 초과 시 분할 필수)
- 로직 파일: 400줄 이하 권장

## 컴포넌트 구조

- 대형 컴포넌트는 디렉토리로 변환: `component-name/index.tsx` + 하위 파일
- 상태 로직은 custom hook으로 분리: `use-component-name.ts`
- shadcn/ui 컴포넌트는 `components/ui/`에만 위치 (수정 가능하나 구조 유지)

## DB 스키마

- `packages/core/src/db/schema/` — Drizzle ORM
- 마이그레이션: `pnpm db:push` (push 방식)
- 스키마 변경 시 타입 호환성 확인 (API → SSE → Frontend)
