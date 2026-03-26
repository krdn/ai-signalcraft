---
phase: 7
slug: collector
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-27
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.4 |
| **Config file** | `packages/collectors/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @signalcraft/collectors test` |
| **Full suite command** | `pnpm --filter @signalcraft/collectors test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @signalcraft/collectors test`
- **After every plan wave:** Run `pnpm --filter @signalcraft/collectors test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | COL-03 | unit | `pnpm --filter @signalcraft/collectors test` | ✅ | ⬜ pending |
| 07-01-02 | 01 | 1 | COL-01 | unit | `pnpm --filter @signalcraft/collectors test` | ✅ | ⬜ pending |
| 07-02-01 | 02 | 1 | COL-01, COL-02 | unit | `pnpm --filter @signalcraft/collectors test` | ✅ | ⬜ pending |
| 07-03-01 | 03 | 2 | COL-04 | unit | `pnpm --filter @signalcraft/collectors test` | ✅ | ⬜ pending |
| 07-04-01 | 04 | 2 | COL-05 | integration | `pnpm --filter @signalcraft/collectors test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — vitest 3.2.4, 49 tests passing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 브라우저 차단 감지 동작 | COL-01 | 실제 사이트 차단은 테스트 환경에서 재현 불가 | 각 사이트에서 수동 수집 실행 후 차단 감지 로그 확인 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
