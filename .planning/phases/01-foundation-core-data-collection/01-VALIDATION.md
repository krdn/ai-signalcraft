---
phase: 1
slug: foundation-core-data-collection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | vitest.config.ts (Wave 0에서 생성) |
| **Quick run command** | `pnpm --filter @ai-signalcraft/core test` |
| **Full suite command** | `pnpm -r test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter <affected-package> test`
- **After every plan wave:** Run `pnpm -r test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | FOUND-01 | smoke | `pnpm -r build` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | FOUND-02 | integration | `pnpm --filter @ai-signalcraft/core test -- --grep "db"` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | FOUND-03 | integration | `pnpm --filter @ai-signalcraft/core test -- --grep "queue"` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | FOUND-04 | unit | `pnpm --filter @ai-signalcraft/core test -- --grep "ai-gateway"` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 2 | COLL-09 | unit | `pnpm --filter @ai-signalcraft/collectors test -- --grep "adapter"` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 2 | COLL-01 | integration | `pnpm --filter @ai-signalcraft/collectors test -- --grep "naver-article"` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 2 | COLL-02 | integration | `pnpm --filter @ai-signalcraft/collectors test -- --grep "naver-comment"` | ❌ W0 | ⬜ pending |
| 01-02-04 | 02 | 2 | COLL-03 | integration | `pnpm --filter @ai-signalcraft/collectors test -- --grep "youtube-video"` | ❌ W0 | ⬜ pending |
| 01-02-05 | 02 | 2 | COLL-04 | integration | `pnpm --filter @ai-signalcraft/collectors test -- --grep "youtube-comment"` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 2 | COLL-10 | integration | `pnpm --filter @ai-signalcraft/core test -- --grep "dedup"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/core/vitest.config.ts` — Vitest 설정
- [ ] `packages/collectors/vitest.config.ts` — Vitest 설정
- [ ] `packages/core/tests/db.test.ts` — DB CRUD 테스트 stub
- [ ] `packages/core/tests/queue.test.ts` — BullMQ flow 테스트 stub
- [ ] `packages/collectors/tests/adapter.test.ts` — Adapter 인터페이스 테스트 stub
- [ ] Framework install: `pnpm add -D vitest` (root + packages)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 운영 서버 DB 연결 | FOUND-02 | 실제 서버 접속 필요 | `psql -h 192.168.0.5 -p 5436 -U postgres -d ai_signalcraft -c "SELECT 1"` |
| 네이버 댓글 API 작동 | COLL-02 | 비공식 API, 외부 의존 | curl로 실제 엔드포인트 호출 후 응답 확인 |
| YouTube API 쿼터 확인 | COLL-03 | Google Cloud 콘솔 필요 | API 키로 실제 search.list 호출 후 quota 소모 확인 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
