---
phase: 5
slug: integration-flow-gap-closure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                         |
| ---------------------- | ------------------------------------------------------------- |
| **Framework**          | Vitest 3.x                                                    |
| **Config file**        | `packages/core/vitest.config.ts`, `apps/web/vitest.config.ts` |
| **Quick run command**  | `pnpm --filter @ai-signalcraft/core test`                     |
| **Full suite command** | `pnpm -r test`                                                |
| **Estimated runtime**  | ~30 seconds                                                   |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @ai-signalcraft/core test`
- **After every plan wave:** Run `pnpm -r test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement                   | Test Type   | Automated Command                                                       | File Exists | Status     |
| -------- | ---- | ---- | ----------------------------- | ----------- | ----------------------------------------------------------------------- | ----------- | ---------- |
| 05-01-01 | 01   | 1    | INT-01 (COLL-01~08, FOUND-03) | unit        | `pnpm --filter @ai-signalcraft/core vitest run tests/queue.test.ts -x`  | ❌ W0       | ⬜ pending |
| 05-01-02 | 01   | 1    | INT-02 (ADVN-01~04, REPT-01)  | unit        | `pnpm --filter @ai-signalcraft/core vitest run tests/report.test.ts -x` | ❌ W0       | ⬜ pending |
| 05-01-03 | 01   | 1    | FLOW-01 (TEAM-01)             | manual-only | N/A                                                                     | N/A         | ⬜ pending |
| 05-01-04 | 01   | 1    | FLOW-01b (TEAM-03)            | unit        | `pnpm --filter @ai-signalcraft/core vitest run tests/db.test.ts -x`     | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `packages/core/tests/queue.test.ts` — sources 필터링 검증 테스트 추가
- [ ] `packages/core/tests/report.test.ts` — upsert 동작 검증 테스트 추가
- [ ] `packages/core/tests/db.test.ts` — getPendingInvites acceptedAt IS NULL 필터 테스트 추가 (신규 또는 기존 확장)

---

## Manual-Only Verifications

| Behavior                         | Requirement       | Why Manual                                                  | Test Instructions                                                                                              |
| -------------------------------- | ----------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| LoginForm callbackUrl 리다이렉트 | FLOW-01 (TEAM-01) | 웹 컴포넌트 테스트 인프라 없음 (Suspense + useSearchParams) | 1. `/login?callbackUrl=/invite/test-token`으로 접속 2. 로그인 수행 3. `/invite/test-token`으로 리다이렉트 확인 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
