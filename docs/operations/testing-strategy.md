# 테스트 전략

리팩토링 마스터플랜 Phase 3에서 수립한 본 프로젝트의 테스트 가이드.

## 원칙

1. **회귀 방지가 목적** — 100% 커버리지 추구하지 않는다. "이 라인이 깨지면 사용자가 즉시 알아챈다"는 핵심 경로만 검증.
2. **빠른 피드백** — 단위 테스트는 모킹으로 빠르게. DB/Redis 통합 테스트는 별도 spec.
3. **CI에서 머지 차단** — 테스트 실패 시 PR 머지 막힘.

## 레이어별 전략

### apps/web (Next.js + tRPC + React)

| 레이어                      | 도구                                      | 모킹 대상                                                 |
| --------------------------- | ----------------------------------------- | --------------------------------------------------------- |
| tRPC 라우터 단위            | `vitest` + `createCaller`                 | next-auth, next/headers, `@ai-signalcraft/core`의 `getDb` |
| 파생 로직 (pipeline-status) | `vitest`                                  | DB 응답을 fixture로 주입                                  |
| React 컴포넌트              | `@testing-library/react` + `vitest` jsdom | hook/query 결과를 props로 직접 주입                       |

**헬퍼**: `apps/web/src/server/trpc/__tests__/test-helpers.ts`

- `setupTrpcTestEnv()` — 라우터 import 부작용 차단
- `makeProtectedCtx(options)` — protectedProcedure 통과하는 ctx 빌더
- `mockDbSelect(rows)` — drizzle select chain mock

### packages/core (분석 파이프라인 + 큐 + DB)

| 레이어                                                      | 도구     | 모킹 대상                      |
| ----------------------------------------------------------- | -------- | ------------------------------ |
| 분석 모듈 (`modules/*`)                                     | `vitest` | LLM 호출은 fixture/snapshot    |
| 파이프라인 헬퍼 (`pipeline-helpers`, `pipeline-pre-stages`) | `vitest` | DB, 자식 함수 모킹             |
| 큐 헬퍼 (`flows`, `startup-cleanup`)                        | `vitest` | BullMQ Queue/Worker mock       |
| 데이터 로더                                                 | `vitest` | collector tRPC 클라이언트 mock |

**헬퍼**: `packages/core/src/__tests__/test-helpers.ts`

- `mockDbSelect(rows)` — drizzle select chain mock
- `mockBullMQ()` — Queue/Worker/FlowProducer stub

### apps/collector (Fastify + BullMQ)

| 레이어                                      | 도구                      | 모킹 대상                   |
| ------------------------------------------- | ------------------------- | --------------------------- |
| tRPC 라우터 (items, subscriptions, sources) | `vitest` + `createCaller` | DB                          |
| 어댑터 (Naver/YouTube/community)            | `vitest`                  | HTTP 응답 (Cheerio fixture) |
| 진단 (collect-source, collect-run)          | `vitest`                  | DB                          |

## 무엇을 테스트하는가

### 우선순위 (핵심 경로 — 마스터플랜 Phase 3 범위)

1. **pipeline-orchestrator** Stage 진행 로직
   - skip된 모듈 건너뛰기
   - 완료 모듈 재실행 안 함 (resume)
   - Stage 1 실패 시 Stage 2 미실행 (failAndAbort)
   - BP 정지 시 status='paused'
   - cancelledByUser/costLimitExceeded 분기
   - reportOnly 모드에서 분석 모듈 미실행

2. **주요 tRPC mutation**
   - 권한 검증 (verifyJobOwnership, verifySubscriptionOwnership)
   - Zod 입력 검증
   - 정상 호출 시 큐 enqueue 또는 DB 변경

3. **pipeline-status 파생 로직**
   - fixture 기반 stage 완료/진행/실패 추론
   - BP 정지 시 이전 단계 완료 표시
   - source별 status 추론

### 우선순위 외 (필요 시 추가)

- 분석 모듈 단위 테스트
- 수집기 어댑터 (실제 사이트 변경 시)
- UI 컴포넌트 (시각적 회귀)

## 테스트 명명/위치

```
src/foo/bar.ts                       — 구현
src/foo/__tests__/bar.test.ts        — 단위 테스트
src/foo/bar.test.ts                  — (deprecated) 같은 디렉토리에 두지 않음
tests/integration/foo-bar.test.ts    — 통합 테스트 (별도 디렉토리)
```

신규 테스트는 `__tests__/` 콜로케이션 패턴을 따른다.

## CI 통합

- `pnpm -r test` — 모든 워크스페이스 단위 테스트
- 실패 시 PR 머지 차단 (`.github/workflows/*.yml` 참조)
- 통합 테스트는 별도 step / 별도 spec
