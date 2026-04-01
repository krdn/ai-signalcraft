## AI SignalCraft

공인 여론 자동 수집·AI 분석 파이프라인 + 웹 대시보드. 소규모 팀(3~10명)이 수동 트리거로 분석 실행.

## Architecture

```
apps/web (Next.js 15 App Router + tRPC + shadcn/ui)
  → packages/core (BullMQ 파이프라인 + Drizzle ORM + AI 분석)
    → packages/collectors (Playwright + Cheerio 수집기)
    → packages/ai-gateway (Vercel AI SDK v6 — Claude/GPT/Gemini)
```

**파이프라인**: 수집(5개 소스) → 정규화 → AI 분석(14개 모듈, Stage 1-4) → 리포트 생성
**인프라**: PostgreSQL + Redis @ 192.168.0.5 | Docker Compose 배포

## Stack

Next.js 15 · TypeScript 5 · React 19 · Drizzle ORM · PostgreSQL 16 · Redis 7
BullMQ 5 · Vercel AI SDK v6 · Zod 3 · tRPC 11 · shadcn/ui · Tailwind 4
Playwright · Cheerio · Recharts · TanStack Query 5 · NextAuth.js 5 · Vitest 3

상세: [docs/tech-stack.md](docs/tech-stack.md)

## Conventions

- **패키지 매니저**: pnpm
- **린팅**: `pnpm lint` (ESLint 9 Flat Config) / `pnpm format` (Prettier)
- **의존성 방향**: web → core → collectors/ai-gateway (역방향 금지)
- **packages 내부 경로 import 금지** — public API(index.ts)만 사용
- **분석 모듈 추가**: `packages/core/src/analysis/modules/` — 기존 모듈 패턴 따를 것
- **수집기 추가**: `packages/collectors/src/adapters/` — `Collector` 인터페이스 구현
- **스크래퍼 오류**: CSS 셀렉터/URL 패턴 변경부터 확인

## Commands

```bash
pnpm dev          # 웹 개발 서버
pnpm dev:all      # 웹 + 워커 동시
pnpm worker       # BullMQ 워커만
pnpm test         # 전체 테스트
pnpm lint         # ESLint
pnpm format       # Prettier
pnpm db:push      # Drizzle 스키마 동기화
pnpm db:studio    # Drizzle Studio
pnpm build        # 프로덕션 빌드
```

## Debugging

- 근본 원인(root cause) 먼저 파악. DB → API → Worker → Frontend 전체 경로 추적
- SQL 변경 시 ambiguous column reference 확인
- UI 콜백 변경 후 전체 사용자 플로우 테스트
