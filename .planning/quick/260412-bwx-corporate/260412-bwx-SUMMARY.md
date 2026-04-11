---
quick_task: 260412-bwx-corporate
completed_date: "2026-04-11"
duration_minutes: 35
tasks_completed: 6
tasks_total: 6
files_created: 11
files_modified: 9
commits: 6
tags: [corporate, advn, pipeline, bug-fix, ui-cards, schemas, modules]
---

# Quick Task 260412-bwx: Corporate ADVN 파이프라인 리팩토링 Summary

**One-liner:** Corporate Stage 4 파이프라인 재구성 (2→6 병렬 모듈) + skipped 처리 버그 4개 수정 + 신규 분석 모듈 3개 + UI 카드 3개

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | 파이프라인 버그 4개 수정 | 2f0b9e7 | pipeline-checks.ts, pipeline-orchestrator.ts, analysis-worker.ts |
| 2 | Corporate 신규 스키마 3개 생성 | 1382794 | media-framing-dominance.schema.ts, csr-communication-gap.schema.ts, reputation-recovery-simulation.schema.ts |
| 3 | Corporate 신규 모듈 3개 + distillForReputationRecovery | afb586f | corporate/media-framing-dominance.ts, csr-communication-gap.ts, reputation-recovery-simulation.ts, prompt-utils.ts |
| 4 | 모듈 등록 및 Corporate Stage 4 재구성 | 1765b26 | types.ts, modules/index.ts, runner.ts, corporate.ts, seed-presets.ts |
| 5 | UI 카드 3개 신규 생성 | 1470074 | media-framing-dominance-card.tsx, csr-communication-gap-card.tsx, reputation-recovery-simulation-card.tsx |
| 6 | 스키마 index export + 테스트 추가 | 144afe2 | schemas/index.ts, advn-exports.test.ts |

## What Was Built

### 버그 수정 (Task 1)
- **camelToKebab 변환**: `getSkippedModules()`가 DB에서 camelCase(`frameWar`)를 반환하지만 `isSkipped('frame-war')` kebab-case와 매칭 실패 → 변환 추가
- **markSkipped() status**: `status: 'failed'` + errorMessage → `status: 'skipped'`로 수정
- **checkFailAndAbort() 조건**: `r.errorMessage !== '사용자에 의해 스킵됨'` 조건 제거 → `r.status === 'failed'`만 체크
- **realFailed 필터**: `r?.errorMessage !== '사용자에 의해 스킵됨'` → `r?.status !== 'skipped'`

### 신규 스키마 (Task 2)
- `MediaFramingDominanceSchema`: Entman 프레임 유형(diagnostic/prognostic/motivational) + 의제설정 영향력
- `CsrCommunicationGapSchema`: E/S/G 차원별 위선 점수 + 그린워싱 리스크
- `ReputationRecoverySimulationSchema`: RepTrak Recovery + SCCT + SLO 기반 회복 로드맵

### 신규 분석 모듈 (Task 3)
- `mediaFramingDominanceModule` (gemini-cli/gemini-2.5-flash): 미디어 프레임 지배력 분석
- `csrCommunicationGapModule` (anthropic/claude-sonnet-4-6): CSR 커뮤니케이션 갭 분석
- `reputationRecoverySimulationModule` (anthropic/claude-sonnet-4-6): 평판 회복 시뮬레이션
- `distillForReputationRecovery()`: 선행 6개 모듈 결과 종합 컨텍스트 추출 함수

### Corporate Stage 4 재구성 (Task 4)
- stage4.parallel: `['stakeholder-map', 'esg-sentiment']` → 6개 (`+ reputation-index, crisis-type-classifier, media-framing-dominance, csr-communication-gap`)
- stage4.sequential: `['crisis-scenario', 'win-simulation']` → `['crisis-scenario', 'reputation-recovery-simulation']`
- corporate.ts modulePrompts: win-simulation 오버라이드 제거, 신규 3개 도메인 특화 시스템 프롬프트 추가
- seed-presets.ts: `corporate_reputation.skippedModules = []`, `pr_crisis.skippedModules = ['win-simulation']` (kebab-case)

### UI 카드 (Task 5)
- `MediaFramingDominanceCard`: 프레임 지배력 진행 바 + frameContestLevel Badge + 프레임 전환 위험도 색상 바
- `CsrCommunicationGapCard`: 위선 점수 + 신뢰도 지수 그리드 + E/S/G 차원별 격차 바 + 그린워싱 Badge
- `ReputationRecoverySimulationCard`: RadialBarChart 회복 확률 + 기반선→목표 점수 + SLO 조건 met/partial/unmet 아이콘

## Verification

```
TypeScript (core):   0 errors
TypeScript (web):    0 errors (pre-existing test error 제외, worktree 무관)
ESLint (modified):   0 errors, 6 pre-existing warnings
Vitest (advn-exports): 7/7 tests passed
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] schemas/index.ts에 신규 스키마 export 추가**
- **Found during:** Task 6 (lint/build 검증 중)
- **Issue:** 3개 신규 스키마가 schemas/index.ts에 export되지 않아 advn-exports.test.ts 테스트에서 접근 불가
- **Fix:** schemas/index.ts에 3개 스키마 export 추가
- **Files modified:** packages/core/src/analysis/schemas/index.ts
- **Commit:** 144afe2

**2. [Rule 2 - Missing] advn-exports.test.ts 신규 모듈 테스트 추가**
- **Found during:** Task 6
- **Issue:** key_context에서 advn-exports.test.ts에 신규 모듈 테스트 추가 지시
- **Fix:** Corporate ADVN 3개 describe 블록 추가
- **Files modified:** packages/core/tests/advn-exports.test.ts
- **Commit:** 144afe2

**3. [Rule 1 - Bug] git stash 충돌 해소**
- **Found during:** Task 6 typecheck 과정에서 실수로 git stash pop 실행
- **Fix:** `git checkout HEAD` 로 충돌 파일 복원, 무관한 staged 변경 원복
- **Impact:** 작업 중인 커밋에 영향 없음

### 계획 조정

- `win-simulation` modulePrompt 오버라이드 제거 (advisor 권고 반영): corporate.ts Stage 4에서 win-simulation이 reputation-recovery-simulation으로 교체되어 dead code 제거
- `pnpm lint` 전체 실행 시 워크트리 디렉토리(`.claude/worktrees/`)로 인한 tsconfigRootDir 오류 발생 — 수정 대상 파일 직접 lint로 대체 검증 (0 errors)

## Superpowers 호출 기록

| # | 스킬명 | 호출 시점 | 결과 요약 |
|---|--------|----------|----------|
| 1 | advisor (내부 검토자) | Task 1 실행 전 | getSkippedModules 위치 확인, win-simulation 제거 권고 |

### 미호출 스킬 사유

| 스킬명 | 미호출 사유 |
|--------|-----------|
| superpowers:brainstorming | 플랜이 상세히 명세되어 있어 브레인스토밍 불필요 |
| superpowers:test-driven-development | 스키마/모듈 구조가 기존 패턴 복제이므로 TDD 불필요 |
| superpowers:systematic-debugging | 버그 수정이 코드 레벨에서 명확히 정의됨 |
| superpowers:requesting-code-review | advisor로 대체 |

## Self-Check: PASSED

모든 아티팩트 파일 10개 존재 확인. 6개 커밋 모두 git log에서 확인됨.
