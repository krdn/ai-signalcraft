---
phase: 02
slug: ai-analysis-engine-report
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-24
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                |
| ---------------------- | -------------------------------------------------------------------- |
| **Framework**          | vitest 3.x                                                           |
| **Config file**        | packages/core/vitest.config.ts, packages/ai-gateway/vitest.config.ts |
| **Quick run command**  | `pnpm --filter @ai-signalcraft/core test`                            |
| **Full suite command** | `pnpm -r test`                                                       |
| **Estimated runtime**  | ~15 seconds                                                          |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @ai-signalcraft/core test`
- **After every plan wave:** Run `pnpm -r test && pnpm -r build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement               | Test Type | Automated Command                                          | Test File                                             | Status     |
| -------- | ---- | ---- | ------------------------- | --------- | ---------------------------------------------------------- | ----------------------------------------------------- | ---------- |
| 02-01-01 | 01   | 1    | ANLZ-01, ANLZ-04, REPT-01 | unit      | `pnpm --filter @ai-signalcraft/core test`                  | `packages/core/tests/analysis-schema.test.ts`         | ⬜ pending |
| 02-01-02 | 01   | 1    | ANLZ-01                   | unit      | `pnpm --filter @ai-signalcraft/ai-gateway build`           | (빌드 검증)                                           | ⬜ pending |
| 02-02-01 | 02   | 2    | ANLZ-01~04, DEEP-01~02    | unit      | `pnpm --filter @ai-signalcraft/core test`                  | `packages/core/tests/analysis-modules-stage1.test.ts` | ⬜ pending |
| 02-03-01 | 03   | 2    | DEEP-03~05, REPT-02       | unit      | `pnpm --filter @ai-signalcraft/core test`                  | `packages/core/tests/analysis-modules-stage2.test.ts` | ⬜ pending |
| 02-04-01 | 04   | 3    | REPT-01                   | unit      | `pnpm --filter @ai-signalcraft/core test`                  | `packages/core/tests/analysis-runner.test.ts`         | ⬜ pending |
| 02-04-02 | 04   | 3    | REPT-01                   | unit      | `pnpm --filter @ai-signalcraft/core test && pnpm -r build` | (빌드 + 테스트 검증)                                  | ⬜ pending |
| 02-05-01 | 05   | 4    | REPT-01~03                | unit      | `pnpm --filter @ai-signalcraft/core test`                  | `packages/core/tests/report.test.ts`                  | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `packages/core/tests/analysis-schema.test.ts` — stubs for DB 스키마, AnalysisModule 인터페이스, 데이터 로더, persist 함수 (Plan 01)
- [ ] `packages/core/tests/analysis-modules-stage1.test.ts` — stubs for Stage 1 모듈 4개 (Plan 02)
- [ ] `packages/core/tests/analysis-modules-stage2.test.ts` — stubs for Stage 2 모듈 4개 (Plan 03)
- [ ] `packages/core/tests/analysis-runner.test.ts` — stubs for 분석 러너 3단계 실행 (Plan 04)
- [ ] `packages/core/tests/report.test.ts` — stubs for 리포트 생성기, PDF 내보내기 (Plan 05)

_Existing vitest infrastructure covers framework needs._

---

## Manual-Only Verifications

| Behavior               | Requirement | Why Manual               | Test Instructions                         |
| ---------------------- | ----------- | ------------------------ | ----------------------------------------- |
| AI 모델 실제 분석 품질 | ANLZ-01~04  | 외부 AI API 의존         | 실제 수집 데이터로 분석 실행 후 결과 검토 |
| PDF 내보내기 렌더링    | REPT-03     | Playwright 브라우저 필요 | 리포트 생성 후 PDF 파일 열어 확인         |
| 토큰 사용량 정확성     | REPT-01     | AI API 실제 응답 필요    | 분석 실행 후 DB에 저장된 토큰 수 확인     |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
