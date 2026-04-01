---
phase: 4
slug: expansion-advanced-analysis
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                |
| ---------------------- | ------------------------------------ |
| **Framework**          | vitest                               |
| **Config file**        | `vitest.config.ts`                   |
| **Quick run command**  | `pnpm vitest run --reporter=verbose` |
| **Full suite command** | `pnpm vitest run`                    |
| **Estimated runtime**  | ~30 seconds                          |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --reporter=verbose`
- **After every plan wave:** Run `pnpm vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type   | Automated Command                             | File Exists | Status     |
| ------- | ---- | ---- | ----------- | ----------- | --------------------------------------------- | ----------- | ---------- |
| TBD     | TBD  | TBD  | COLL-06     | integration | `pnpm vitest run --grep "dcinside"`           | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | COLL-07     | integration | `pnpm vitest run --grep "fmkorea"`            | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | COLL-08     | integration | `pnpm vitest run --grep "clien"`              | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | ADVN-01     | unit        | `pnpm vitest run --grep "approval-rating"`    | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | ADVN-02     | unit        | `pnpm vitest run --grep "frame-war"`          | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | ADVN-03     | unit        | `pnpm vitest run --grep "crisis-scenario"`    | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | ADVN-04     | unit        | `pnpm vitest run --grep "victory-simulation"` | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] Test stubs for community collector adapters (COLL-06, COLL-07, COLL-08)
- [ ] Test stubs for advanced analysis modules (ADVN-01~04)
- [ ] Mock fixtures for scraped HTML samples (DC갤러리, 에펨코리아, 클리앙)

_Existing vitest infrastructure covers framework setup._

---

## Manual-Only Verifications

| Behavior                  | Requirement | Why Manual                  | Test Instructions                                    |
| ------------------------- | ----------- | --------------------------- | ---------------------------------------------------- |
| 실제 사이트 스크래핑 동작 | COLL-06~08  | 외부 사이트 의존, 차단 위험 | 개발 서버에서 실제 키워드로 수집 트리거 후 결과 확인 |
| 고급 분석 탭 시각화       | D-08        | UI 렌더링 검증              | 대시보드 접속 후 고급 분석 탭에서 차트 렌더링 확인   |
| AI 지지율 면책 문구 표시  | ADVN-01     | 텍스트 품질 주관적 판단     | 리포트 생성 후 면책 문구 및 신뢰도 표현 확인         |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
