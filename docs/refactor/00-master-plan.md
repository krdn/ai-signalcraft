# AI SignalCraft 리팩토링 마스터플랜

## Context

**프로젝트**: 공인 여론 자동 수집·AI 분석 파이프라인. 소규모 팀(3~10명) 사용. PostgreSQL+Redis @ 192.168.0.5, Docker Compose 배포. 다운타임 5~10분 허용.

**리팩토링 동기**: 점진적 기능 추가 과정에서 누적된 부채를 정리하여 유지보수성·업그레이드 가능성·테스트 안정성을 회복. 현재 발견된 핫스팟:

- `apps/web/package.json`의 `latest` 5건 (next/react/react-dom/@types) — 프로덕션에서 패치 시 깨질 위험
- `next-auth: 5.0.0-beta.30` — 베타 의존
- 1000줄 초과 파일 7개 (`workflow/page.tsx` 2,093줄, `trigger-form.tsx` 1,057줄, `collected-data.ts` 1,036줄, `pipeline-orchestrator.ts` 780줄, `subscriptions.ts` 793줄, `pipeline-worker.ts` 615줄, `items.ts` 850줄)
- `as any` / `as unknown as` 캐스팅 139건 (특히 `pipeline-status/index.ts` 6건이 `collection_jobs` 스키마 추론 손실로 발생)
- 테스트 커버리지 ~8% — 핵심 경로(`pipeline-orchestrator`, 주요 tRPC mutation) 회귀 보호 미흡

**의도된 결과**: 16~20개의 작은 PR을 단계별 순차 진행하여 단일 다운타임 5~10분 윈도우로 처리. 각 PR은 단일 revert 가능. 100% 커버리지·완벽 분할이 아닌 "아픈 곳부터" 정리.

---

## 전략 원칙

1. **점진적 진화** — 빅뱅 금지. 모든 PR 머지 후 즉시 배포 가능.
2. **회귀 방지 우선** — 신규 테스트는 핵심 경로만. 100% 커버리지 추구하지 않음.
3. **롤백 가능성** — 모든 PR 단일 revert. 의존성·구조 변경은 특히.
4. **YAGNI** — 정당화되지 않는 분할은 보류. `report-data.ts` 분해 보류, Phase 4 조건부 진입.
5. **In-flight job 보호** — 워커 재시작 시: 큐 pause → drain → 재시작. 이번 세션에서 추가한 `recoverOrphanedCollectionJobs`와 충돌하지 않도록.

---

## Phase 1 — 운영 안정성 (4 PR)

### 목표

"오늘 빌드되던 것이 내일 패치로 깨지는" 리스크 제거. next-auth 베타 마이그레이션 경로 사전 평가.

### 범위

**IN**: `apps/web/package.json` `latest` 5건 → SemVer 고정. engines 필드 추가. next-auth 안정화 평가 보고서. lockfile 정합성 검증.

**OUT**: next-auth 실제 마이그레이션 (별도 spec). Drizzle / BullMQ / tRPC 메이저 업그레이드. Next 16/React 19 신기능 도입.

### PR 시퀀스

#### PR 1-A: 의존성 버전 고정

**파일**: `apps/web/package.json`

```diff
- "next": "latest",            → "next": "16.2.2",
- "react": "latest",            → "react": "19.2.4",
- "react-dom": "latest",        → "react-dom": "19.2.4",
- "@types/react": "latest",     → "@types/react": "19.2.0",
- "@types/react-dom": "latest", → "@types/react-dom": "19.2.0",
```

**검증**: `pnpm -r build` PASS. `pnpm -r test` PASS. dev 모드에서 5개 페이지 수동 점검(대시보드/구독/분석트리거/리포트/어드민). 프로덕션 모드 로컬 가동.
**다운타임**: 0분 (코드 동일, 명시화만)
**롤백**: 단일 revert.

#### PR 1-B: engines + Node 버전 명시

**파일**: 루트 `package.json`, `.nvmrc` (없으면 신규)

- `engines: { node: ">=20.18 <23", pnpm: ">=10.28 <11" }`
- Docker 이미지 베이스 Node와 일치 검증
- `docs/operations/runtime-versions.md` 신규
  **검증**: CI에서 mismatch 시 명확한 에러
  **다운타임**: 0분.

#### PR 1-C: next-auth 5 안정화 평가 보고서 (코드 변경 없음)

**산출물**: `docs/superpowers/specs/refactor/next-auth-stable-eval.md`
**조사 항목**:

- next-auth 5 안정 릴리스 일정 (현재 5.0.0-beta.30 — changelog 확인)
- `@auth/drizzle-adapter` 호환성 매트릭스
- 변경되는 API 표면: `auth()` 헬퍼, JWT 콜백, `signIn`/`signOut` 서버 액션, `getServerSession` deprecation
- 우리 코드의 사용 지점 인벤토리: `apps/web/src/server/trpc/init.ts` (세션 추출), 미들웨어, drizzle adapter
- 리스크: 마이그레이션 시 JWT 비밀 키 처리 변경 → 전 사용자 강제 로그아웃 가능
- 결정: 안정화 마이그레이션은 별도 spec
  **검증**: 문서 리뷰만.
  **다운타임**: 0분.

#### PR 1-D: lockfile 정합성 점검

- `@krdn/ai-analysis-kit` git 의존성의 lockfile commit SHA 잠금 확인
- pnpm-lock.yaml diff 없음 확인 (의도된 변경만)
  **검증**: lockfile diff에서 의도된 변경만
  **다운타임**: 0분.

### Phase 1 종료 기준

- [ ] `latest` 의존성 0건
- [ ] `pnpm -r build` PASS
- [ ] CI에서 Node/pnpm 버전 검증 활성
- [ ] next-auth 평가 보고서 머지

---

## Phase 2 — 코드 유지보수성 (7 PR)

### 목표

- 1000줄 초과 단일 파일의 인지 부하 제거
- TypeScript 타입 안정성 회복: 핵심 핫스팟 `as any` 0건, 전체 50건 미만(현재 139건)
- pipeline-orchestrator의 Stage 1/2/4 경계 보존

### 범위

**IN**: 4개 핵심 대형 파일 분해(workflow page, trigger-form, collected-data, pipeline-orchestrator) + 워커 1건(pipeline-worker) + collector 1건(items.ts) + 타입 인프라 PR.

**OUT**:

- `whitepaper/report-data.ts` (2,651줄) — **분해 안 함**. 단일 사용처(whitepaper-report.tsx)에 14개 모듈 상수, 분해 비용 > 이득. 빌드 7초로 인덱싱 이슈 없음.
- `subscriptions.ts` (793줄), `analysis.ts` (617줄) 라우터 — Phase 2 범위에서 제외(우선순위 낮음)
- 신규 기능, API shape 변경, DB 마이그레이션
- 100% 타입 안정성

### PR 시퀀스 (권장 순서)

#### PR 2-A: 타입 인프라 — collection_jobs 타입 통일

**문제**: `pipeline-status/index.ts`에서 `(job as any).pausedAtStage`, `(job as any).options?.enableItemAnalysis` 등 6건. `db.select().from(collectionJobs)` 결과 타입 추론이 어딘가에서 손실됨(jsonb $type 약점 또는 re-export 손실).

**작업**:

1. `packages/core/src/db/schema/collections.ts`: `export type CollectionJob = typeof collectionJobs.$inferSelect;` 명시
2. `packages/core/src/index.ts`: `export type { CollectionJob }` 추가
3. `apps/web/src/server/pipeline-status/index.ts`: 타입 import + `as any` 6건 제거
4. `apps/web/src/server/trpc/routers/collected-data.ts`: `input.source as any` 3건 → `DataSourceKey` 타입 정합화

**검증**: `pnpm typecheck` PASS. `/api/trpc/pipeline.status` 응답 키셋 변경 없음. 대시보드/분석 페이지 회귀 없음.
**다운타임**: 0분.

#### PR 2-E: collected-data 라우터 분해 (1,036줄)

**전략**: `apps/web/src/server/trpc/routers/collected-data/` 디렉토리

- `index.ts` — 라우터 조립
- `list.ts`, `by-id.ts`, `export.ts`, `stats.ts` 단위 분할
- `shared/` — Zod 스키마, 헬퍼

**검증**: `trpc.collectedData.*.useQuery` 호출 표면 변화 없음. 응답 shape 동일.
**다운타임**: 0분 (web 5분 재시작).

#### PR 2-C: subscriptions/workflow/page.tsx 분해 (2,093줄)

**전략**: `apps/web/src/app/subscriptions/workflow/` 콜로케이션

- `_components/`: workflow-stepper, source-selector, keyword-input, limits-panel, preset-selector, cost-estimator, review-and-submit
- `_hooks/`: use-workflow-state, use-trigger-mutation
- `page.tsx`: 200줄 미만 컴포지션

**검증**: 모든 단계 클릭 → mutation payload 네트워크 탭 diff 없음. 'use client' 디렉티브 정확히 위치.
**다운타임**: 0분 (web 5분 재시작).

#### PR 2-D: trigger-form.tsx 분해 (1,057줄)

**전략**: `apps/web/src/components/analysis/trigger-form/`

- `trigger-form.tsx` (메인, 200줄 미만)
- `domain-selector.tsx`, `module-toggle-list.tsx`, `cost-preview.tsx`, `advanced-options.tsx`, `optimization-preset-picker.tsx`
- `_hooks/use-trigger-form.ts`

**검증**: 분석 트리거 mutation payload 동일. validation 메시지 동일.
**다운타임**: 0분.

#### PR 2-B: pipeline-orchestrator 분해 (780줄)

**원칙**: Stage 경계와 모듈 추가 패턴(`STAGE1_MODULES` 등) **절대 변경하지 않음**.

**전략**: `packages/core/src/analysis/pipeline-orchestrator/` 디렉토리

- `index.ts` — `runAnalysisPipeline` 메인 (200~250줄)
- `stage0-item-analysis.ts`, `stage1.ts`, `stage2.ts`, `stage3-final-summary.ts`, `stage4-advanced.ts`
- `delta-and-manipulation.ts` — runSeriesDeltaAnalysis + runStage5Manipulation
- `resume-options.ts` — `ResumeOptions` 인터페이스

**외부 표면 보존**: `runAnalysisPipeline(jobId, options?)` 시그니처 동일. `analysis-worker.ts` 호출 변경 없음.

**검증**: 기존 테스트 PASS. 로컬 docker-compose에서 분석 1건 (정치 도메인 50개 항목) 처음~끝 실행 → 동일 모듈 결과셋, 동일 Stage 진행 로그. DB의 `collection_jobs.progress`, `analysis_results` 행 동일 패턴.

**다운타임**: 워커 재시작 5~10분. 큐 pause → drain → 배포 → resume.
**리스크**: import 누락 시 런타임 ReferenceError. 로컬 워커 부팅 시 import 에러 없음 확인 후 머지.

#### PR 2-F: pipeline-worker.ts 분해 (615줄)

**전략**: `packages/core/src/queue/pipeline-worker/`

- `index.ts` — `createPipelineHandler` 진입
- `handlers/naver.ts`, `handlers/youtube.ts`, `handlers/community.ts`, `handlers/feed.ts`
- `post-process.ts` — embedding, item-analysis, classify trigger

**Job data shape 보존**: `{ source, dbJobId }`

**검증**: 5개 소스 1건씩 수동 수집 → articles/videos/comments 행 추가 패턴 동일. recoverOrphanedCollectionJobs와 충돌 없음(큐 비어있을 때 호출).
**다운타임**: 워커 재시작 5~10분.

#### PR 2-H: collector/items.ts 분해 (850줄)

**전략**: PR 2-E와 동일 패턴. collector tRPC 라우터에 적용.
**다운타임**: collector-api 1~2분.

### Phase 2 종료 기준

- [ ] 1000줄 초과 파일 0건 (report-data.ts 제외)
- [ ] `pipeline-status/index.ts`의 `as any` 0건
- [ ] 핵심 핫스팟 `as any` 50% 이상 감소
- [ ] 매 PR마다 `pnpm typecheck` + `pnpm test` PASS
- [ ] 매 PR마다 수동 통합 테스트 5분 시나리오 PASS

---

## Phase 3 — 핵심 경로 테스트 (4 PR)

### 목표

회귀 방지 중심. "이게 깨지면 사용자가 즉시 알아챈다" 경로만.

### 범위

**IN**: pipeline-orchestrator Stage 진행 로직, analysis runner, 주요 tRPC mutation (analysis.trigger / subscriptions.triggerSubscription / subscriptions CRUD / collectedData.list), pipeline-status 파생 로직.

**OUT**: 모든 분석 모듈 단위 테스트 (필요 시 추가). Playwright E2E. UI 컴포넌트 단위 테스트.

### PR 시퀀스

#### PR 3-A: 테스트 인프라 정리

- vitest workspace config 정리
- DB 의존 테스트 전략 결정 (1차: 모킹. 통합 테스트는 별도 phase)
- tRPC `createCallerFactory` 헬퍼: `apps/web/src/server/trpc/__tests__/test-helpers.ts`
- BullMQ 모킹 헬퍼: `packages/core/src/__tests__/test-helpers.ts`
- `docs/testing-strategy.md` 가이드

**검증**: 샘플 테스트 1건 통과.
**다운타임**: 0분.

#### PR 3-B: pipeline-orchestrator 테스트

**대상**: PR 2-B로 분해된 모듈 + 통합

**케이스**:

- skip된 모듈 건너뛰기
- 완료 모듈 재실행 안 함 (resume)
- Stage 1 실패 시 Stage 2 미실행 (failAndAbort)
- BP 정지 시 status='paused'
- `cancelledByUser` 정확히 반환
- `costLimitExceeded` 분기
- `reportOnly` 모드에서 분석 모듈 미실행

**파일**:

- `pipeline-orchestrator/__tests__/skip-resume.test.ts`
- `pipeline-orchestrator/__tests__/cancel-pause.test.ts`
- `pipeline-orchestrator/__tests__/cost-limit.test.ts`

**전략**: `runModule` 모킹. DB 트랜잭션 롤백 또는 in-memory.
**다운타임**: 0분.

#### PR 3-C: tRPC 핵심 mutation 테스트

**케이스**:

- `analysis.trigger`: 권한 없는 jobId → FORBIDDEN, 정상 호출 → 큐 enqueue, 중복 트리거 거부
- `subscriptions.triggerSubscription`: 소유권 검증, collection_jobs 행 생성
- `subscriptions.create`: Zod 입력 검증

**파일**:

- `apps/web/src/server/trpc/routers/__tests__/analysis.test.ts`
- `apps/web/src/server/trpc/routers/__tests__/subscriptions.test.ts`

**다운타임**: 0분.

#### PR 3-D: pipeline-status 파생 로직 테스트

**케이스**: fixture 기반(다양한 collection_jobs 상태)으로 stage 완료/진행/실패 추론, BP 정지 시 이전 단계 완료 표시, source별 status 추론.

**파일**: `apps/web/src/server/pipeline-status/__tests__/derive.test.ts`
**다운타임**: 0분.

### Phase 3 종료 기준

- [ ] 신규 테스트 30~50건
- [ ] pipeline-orchestrator 라인 커버리지 70%+
- [ ] 핵심 mutation 커버리지 50%+
- [ ] CI에서 테스트 실패 시 머지 차단

---

## Phase 4 — packages/core 분할 (조건부, 0~1 PR)

### 진입 조건

**Phase 3 종료 시점에 다음 정량 측정 후 결정**:

1. packages/core 빌드 시간이 10초 초과? (현재 7.15초)
2. 순환 의존이 코드 변경을 막고 있는가?
3. schema 변경 시 web/worker 동시 재빌드가 실측 부담인가?

**세 답이 모두 "아니오"면 Phase 4 연기 + spec만 남김.**

### 사전 조사 결과 (현재)

- 빌드 7.15초 — 분리 이득 측정 어려움
- web에서 core import 중 schema-only 사용 6개 파일 — db-schema 분리 효과 작음
- 분석 영역 30일간 45개 파일 수정 — 가장 활발하지만 분리 대상 아님(순환 의존 위험)

### 진입 시 범위 (조건부)

**IN**: `packages/db-schema` 분리만 (가장 가치 있음 — DB 스키마는 SQL 진실의 원천)

**OUT**:

- analysis/ 분리 — 21K줄 중 대부분, 모듈 추가 시 두 패키지 수정 필요. 비용 > 이득.
- pipeline/, queue/ 분리 — 강결합. 묶어둠.
- metrics/, alerts/ 분리 — 가치 작음, 사후 검토.

### PR 4-A (조건 충족 시): db-schema 패키지 분리

**작업**:

1. `packages/db-schema/` 신규 — `packages/core/src/db/schema/*` 이동
2. `packages/core`는 `@ai-signalcraft/db-schema` import
3. drizzle.config, 마이그레이션 신규 패키지로 이동
4. `db:push`, `db:studio` 스크립트 위치 변경
5. `madge --circular` 검사

**검증**: `db:push` 정상 동작 (스키마 변경 없으니 noop). 워커/web 빌드 PASS. Phase 3 테스트 100% PASS.
**다운타임**: 0분 (런타임 동작 동일, 코드 위치만).
**롤백**: 단일 revert. 디렉토리 이동 diff 노이즈 큼.

### Phase 4 종료 기준 (조건 충족 시)

- [ ] `madge --circular` 0건
- [ ] db-schema 분리 후 web/worker 빌드 시간 측정값 비교
- [ ] Phase 3 테스트 PASS

---

## 함정 종합

### Next.js 16 + React 19

| 함정                                   | 영향                                                  | 대응                         |
| -------------------------------------- | ----------------------------------------------------- | ---------------------------- |
| `use cache` 디렉티브                   | SSR 캐싱 동작 변경                                    | 본 마스터플랜에서 도입 안 함 |
| async Server Components / `use()` hook | Suspense 경계 변경                                    | 도입 안 함 (YAGNI)           |
| Server Actions form action             | trigger-form 분해 시 'use server' 위치 잘못 옮길 위험 | PR 2-D 리뷰에서 명시 검토    |
| `forwardRef` 비권장 → ref prop         | API 변경                                              | 분해 PR에서 변경 안 함       |
| StrictMode useEffect double-invoke     | dev만 영향                                            | 운영 무관                    |

### next-auth 5 베타

- JWT signing key 처리 변경 시 전 사용자 강제 로그아웃 가능
- `@auth/drizzle-adapter` API 시그니처 변경 가능
- Phase 1 PR 1-C로 영향 범위 사전 확정 → 별도 마이그레이션 spec

### packages/core 분할

- analysis ↔ queue 양방향 의존 위험 — 분할 안 함
- 분석 모듈 추가 패턴(`add-domain` 스킬 연계) 보존 필수

### pipeline-orchestrator 분해

- `STAGE1_MODULES`, `STAGE2_MODULES`, `getStage4Modules` export 경로 변경 금지

### Drizzle 0.40 → 0.44+ 업그레이드

- 본 마스터플랜에서 **수행 안 함**
- 마이너 업그레이드도 SQL 생성 변경 가능
- 별도 spec: 0.41→0.42→0.43→0.44 단계별 PR + `db:push` 스냅샷 비교

### 워커 재시작 절차

이번 세션에서 추가한 `recoverOrphanedCollectionJobs`와 충돌하지 않도록:

1. Web에서 큐 트리거 일시 차단
2. BullMQ pipeline/analysis 큐 pause
3. active job drain (최대 10분, 타임아웃 시 SIGTERM)
4. 새 워커 배포 → recoverOrphanedCollectionJobs가 stale active job 정리
5. 큐 resume + 트리거 재허용

---

## Critical Files

### Phase 1

- `/home/gon/projects/ai/ai-signalcraft/apps/web/package.json`
- `/home/gon/projects/ai/ai-signalcraft/package.json`
- `/home/gon/projects/ai/ai-signalcraft/.nvmrc`

### Phase 2

- `/home/gon/projects/ai/ai-signalcraft/packages/core/src/db/schema/collections.ts`
- `/home/gon/projects/ai/ai-signalcraft/packages/core/src/index.ts`
- `/home/gon/projects/ai/ai-signalcraft/apps/web/src/server/pipeline-status/index.ts`
- `/home/gon/projects/ai/ai-signalcraft/apps/web/src/server/trpc/routers/collected-data.ts`
- `/home/gon/projects/ai/ai-signalcraft/apps/web/src/app/subscriptions/workflow/page.tsx`
- `/home/gon/projects/ai/ai-signalcraft/apps/web/src/components/analysis/trigger-form.tsx`
- `/home/gon/projects/ai/ai-signalcraft/packages/core/src/analysis/pipeline-orchestrator.ts`
- `/home/gon/projects/ai/ai-signalcraft/packages/core/src/queue/pipeline-worker.ts`
- `/home/gon/projects/ai/ai-signalcraft/apps/collector/src/server/trpc/items.ts`

### Phase 3

- `/home/gon/projects/ai/ai-signalcraft/apps/web/src/server/trpc/__tests__/test-helpers.ts` (신규)
- `/home/gon/projects/ai/ai-signalcraft/packages/core/src/__tests__/test-helpers.ts` (신규)
- `/home/gon/projects/ai/ai-signalcraft/packages/core/src/analysis/pipeline-orchestrator/__tests__/` (신규 디렉토리)

### Phase 4 (조건부)

- `/home/gon/projects/ai/ai-signalcraft/packages/db-schema/` (신규 패키지)

---

## Verification (전체)

각 PR마다:

1. `pnpm typecheck` PASS
2. `pnpm -r test` PASS
3. `pnpm -r build` PASS
4. **수동 통합 시나리오** (5분):
   - 로그인 → 대시보드 → 새 분석 트리거(50개 한도) → 진행 모니터 → 완료 → 리포트
   - 구독 워크플로 → 새 구독 생성 → 즉시 트리거
5. PR 머지 후 운영 배포 (web 5분 / 워커 5~10분 / collector 1~2분 다운타임 윈도우)
6. 배포 후 5분 모니터링: `dserver logs ais-prod-worker --tail 100`, `dserver logs ais-prod-web --tail 100`

각 Phase 종료 시:

- 정량 종료 기준 충족 여부 점검
- 다음 Phase 진입 또는 일시 정지 결정

---

## 정량 종료 기준 요약

| Phase | 기준                                                                                           |
| ----- | ---------------------------------------------------------------------------------------------- |
| 1     | `latest` 의존성 0건. CI Node/pnpm 검증 활성. next-auth 평가 보고서 머지.                       |
| 2     | 1000줄 초과 파일 0건(report-data.ts 제외). pipeline-status `as any` 0건. 핫스팟 `as any` 50%↓. |
| 3     | 신규 테스트 30~50건. pipeline-orchestrator 라인 커버리지 70%+. CI 머지 차단 활성.              |
| 4     | (조건부) `madge --circular` 0건. 빌드 시간 비교 측정.                                          |

---

## 총 예상 PR 개수

- Phase 1: 4 PR
- Phase 2: 7 PR
- Phase 3: 4 PR
- Phase 4: 0~1 PR (조건부)

**합계: 15~16 PR**, 1 PR당 평균 1~3일 작업, 단일 작업자 6~10주.

## 다음 단계

이 마스터플랜 승인 후:

1. `docs/superpowers/specs/refactor/00-master-plan.md`로 프로젝트 spec 디렉토리에 commit
2. Phase 1 진입 — `01-phase1-dependencies.md` spec으로 PR 분해
3. 각 phase는 종료 기준 충족 후 다음 phase 진입 (writing-plans 스킬로 구체 plan 생성)
