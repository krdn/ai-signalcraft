---
phase: 9
slug: types-tests
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 |
| **Config file** | 각 패키지별 vitest.config.ts |
| **Quick run command** | `pnpm --filter @ai-signalcraft/core test` |
| **Full suite command** | `pnpm -r test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @ai-signalcraft/{해당패키지} test`
- **After every plan wave:** Run `pnpm -r test`
- **Before `/gsd:verify-work`:** Full suite must be green + `pnpm -r build`
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | TYPE-01 | typecheck | `pnpm -r build` | ✅ (tsc) | ⬜ pending |
| 09-01-02 | 01 | 1 | TYPE-01 | typecheck | `pnpm -r build` | ✅ (tsc) | ⬜ pending |
| 09-02-01 | 02 | 1 | TYPE-02 | unit | `pnpm --filter @ai-signalcraft/ai-gateway test` | ❌ W0 | ⬜ pending |
| 09-03-01 | 03 | 2 | TYPE-03 | unit | `pnpm --filter @ai-signalcraft/core test` | ❌ W0 | ⬜ pending |
| 09-XX-XX | all | all | TYPE-04 | integration | `pnpm -r test` | ✅ (기존) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/ai-gateway/tests/gateway.test.ts` — TYPE-02 단위 테스트 파일 (Plan에서 생성)
- [ ] `packages/core/tests/advn-approval-rating.test.ts` — TYPE-03 분할 파일
- [ ] `packages/core/tests/advn-frame-war.test.ts` — TYPE-03 분할 파일
- [ ] `packages/core/tests/advn-crisis-scenario.test.ts` — TYPE-03 분할 파일
- [ ] `packages/core/tests/advn-win-simulation.test.ts` — TYPE-03 분할 파일
- [ ] `packages/core/tests/advn-exports.test.ts` — TYPE-03 분할 파일

---

## Pre-existing Test Failures (TYPE-04 baseline)

| File | Failed | Reason | Phase 9 범위? |
|------|--------|--------|--------------|
| analysis-runner.test.ts | 4 tests | DB mock 부재 (getModuleModelConfig) | 아니오 |
| report.test.ts | 2 tests | 동일 원인 | 아니오 |

**TYPE-04 판정 기준:** Phase 9 변경 후 사전 실패 6개를 제외한 나머지 96개 테스트가 모두 통과하면 요건 충족.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| barrel export 경로 호환성 | TYPE-01 | import 경로 변경이 런타임 문제 유발 가능 | `pnpm -r build` 성공 확인 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
