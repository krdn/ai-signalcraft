---
phase: 3
slug: dashboard-team
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | apps/web/vitest.config.ts (Wave 0 installs) |
| **Quick run command** | `pnpm --filter web test -- --run` |
| **Full suite command** | `pnpm --filter web test -- --run && pnpm tsc --noEmit -p apps/web/tsconfig.json` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter web test -- --run`
- **After every plan wave:** Run `pnpm --filter web test -- --run && pnpm tsc --noEmit -p apps/web/tsconfig.json`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | DASH-01, TEAM-01 | integration | `pnpm --filter web test -- --run` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | DASH-01, DASH-02 | unit | `pnpm --filter web test -- --run` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | DASH-03, DASH-04, DASH-07 | unit | `pnpm --filter web test -- --run` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 2 | DASH-05, DASH-06 | unit | `pnpm --filter web test -- --run` | ❌ W0 | ⬜ pending |
| 03-05-01 | 05 | 3 | TEAM-02, TEAM-03 | integration | `pnpm --filter web test -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest` + `@testing-library/react` — 테스트 프레임워크 설치
- [ ] `apps/web/vitest.config.ts` — Vitest 설정
- [ ] `apps/web/src/__tests__/setup.ts` — 테스트 셋업 (jsdom)

*Wave 0 는 Plan 01 (스캐폴딩) 에서 함께 처리*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 차트 시각적 렌더링 확인 | DASH-03 | 차트 SVG 렌더링은 시각적 검증 필요 | 브라우저에서 감성 비율 Donut + 시계열 Line 차트 확인 |
| 워드클라우드 렌더링 | DASH-04 | Canvas/SVG 기반 시각 컴포넌트 | 브라우저에서 워드클라우드 표시 확인 |
| 다크모드 테마 일관성 | DASH-* | CSS 테마 시각적 일관성 | 전체 페이지 다크모드 스크린샷 확인 |
| Google OAuth 로그인 | TEAM-01 | 외부 OAuth 프로바이더 필요 | Google OAuth 설정 후 실제 로그인 테스트 |
| 이메일 초대 링크 발송 | TEAM-02 | 외부 메일 서버 필요 | Resend/SMTP 설정 후 실제 초대 메일 수신 확인 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
