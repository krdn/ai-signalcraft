---
phase: 02
slug: ai-analysis-engine-report
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | packages/core/vitest.config.ts, packages/ai-gateway/vitest.config.ts |
| **Quick run command** | `pnpm --filter @ai-signalcraft/core test` |
| **Full suite command** | `pnpm -r test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @ai-signalcraft/core test`
- **After every plan wave:** Run `pnpm -r test && pnpm -r build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | ANLZ-01~04 | unit | `pnpm --filter @ai-signalcraft/core test` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | DEEP-01~05 | unit | `pnpm --filter @ai-signalcraft/core test` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 3 | REPT-01~03 | unit | `pnpm --filter @ai-signalcraft/core test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/core/tests/analysis.test.ts` — stubs for ANLZ-01~04, DEEP-01~05
- [ ] `packages/core/tests/report.test.ts` — stubs for REPT-01~03
- [ ] `packages/ai-gateway/tests/gateway.test.ts` — AI Gateway expansion tests

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AI 모델 실제 분석 품질 | ANLZ-01~04 | 외부 AI API 의존 | 실제 수집 데이터로 분석 실행 후 결과 검토 |
| PDF 내보내기 렌더링 | REPT-03 | Playwright 브라우저 필요 | 리포트 생성 후 PDF 파일 열어 확인 |
| 토큰 사용량 정확성 | REPT-01 | AI API 실제 응답 필요 | 분석 실행 후 DB에 저장된 토큰 수 확인 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
