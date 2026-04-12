---
phase: quick
plan: 260412-bwx-corporate-frontend
subsystem: apps/web
tags: [corporate, domain, ui, settings, advanced-help, domain-help]
dependency_graph:
  requires: []
  provides: [corporate-domain-ui]
  affects: [model-settings, domain-help, advanced-help]
tech_stack:
  added: []
  patterns: [domain-module-registry, module-meta-pattern]
key_files:
  modified:
    - apps/web/src/components/settings/model-settings.tsx
    - apps/web/src/components/landing/data/domain-help.ts
    - apps/web/src/components/advanced/advanced-help.tsx
decisions:
  - crisis-scenario 모듈을 corporate DOMAIN_MODULES에 공유 포함 (political과 동일 모듈, 기업 맥락으로 재활용)
  - MODULE_META에 reputation-recovery-simulation 포함 (태스크 명세에는 7개라고 했으나 실제 추가는 7개 신규 + crisis-scenario 공유)
metrics:
  duration: ~10min
  completed: 2026-04-12
  tasks: 3
  files: 3
---

# Phase quick Plan 260412-bwx-corporate-frontend Summary

**One-liner:** corporate 도메인 전용 UI 등록 — ModuleMeta 타입 확장, 7개 신규 모듈 메타데이터, Stage 4 도움말 데이터 완비

## What Was Built

3개 프론트엔드 파일에 corporate 도메인을 완전히 등록했습니다.

### Task 1 — model-settings.tsx (AI 설정 UI)

- `ModuleMeta.domain` 타입에 `'corporate'` 추가
- `MODULE_META`에 기업 평판 전용 모듈 7개 추가:
  - `stakeholder-map`, `esg-sentiment`, `reputation-index`, `crisis-type-classifier`, `media-framing-dominance`, `csr-communication-gap`, `reputation-recovery-simulation`
- `DOMAIN_MODULES.corporate` 배열 등록 (8개: 위 7개 + 공유 `crisis-scenario`)
- `PRESET_DOMAIN_MAP.corporate_reputation` → `domain: 'corporate'`으로 수정 (기존 `'political'` 오류 수정)
- `getModulesForPreset` — corporate 포함 및 `DOMAIN_MODULES[domain] ?? DOMAIN_MODULES.political` fallback 방어 코드 추가

### Task 2 — domain-help.ts (랜딩 도메인 도움말)

- corporate Stage 4 label을 `'기업 평판 고급 분석 (ADVN)'`으로 변경
- 모듈 4개 → 8개로 확장 (이해관계자 지도, ESG, RepTrak, SCCT 분류, 미디어 프레임, CSR 간극, 위기 시나리오, 평판 회복)
- `theoreticalBasis` 3개 → 6개로 확장:
  - 추가: Signaling Theory(Spence, 1973), Media Framing Theory(Entman, 1993), SCCT(Coombs, 2007)

### Task 3 — advanced-help.tsx (고급 분석 카드 도움말)

- `ADVANCED_HELP` 객체에 corporate 도메인 모듈 7개 도움말 추가
- 각 모듈에 `details`, `howToRead`, `tips`, `limitations`, `technicalDetails`, `source` 완비
- 이론적 배경 명시: Mitchell et al.(1997), Fombrun & van Riel(2004), Coombs(2007), Benoit(1997), Entman(1993), Brunsson(1989)

## Commits

| Hash    | Message                                                                 |
| ------- | ----------------------------------------------------------------------- |
| cd7fd39 | feat: AI 설정 UI에 corporate 도메인 및 신규 모듈 8개 추가               |
| a2e51d7 | feat: corporate 도메인 도움말 — Stage 4 모듈 8개 및 이론 5개로 업데이트 |
| cad047f | feat: corporate ADVN 모듈 7개 고급 도움말 추가                          |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PRESET_DOMAIN_MAP.corporate_reputation 도메인 오류 수정**

- **Found during:** Task 1
- **Issue:** `corporate_reputation` 프리셋이 `domain: 'political'`로 잘못 매핑되어 있어, 기업 평판 프리셋 선택 시 정치 도메인 모듈이 표시되는 버그
- **Fix:** `domain: 'corporate'`로 수정 (1-D 작업 명세와 동일)
- **Files modified:** `apps/web/src/components/settings/model-settings.tsx`
- **Commit:** cd7fd39

### 계획 대비 차이

- Task 1 명세에서는 모듈을 "7개 추가"라고 표현했으나 실제로는 `reputation-recovery-simulation` 포함 7개 신규 모듈 + `crisis-scenario` 공유로 총 8개가 `DOMAIN_MODULES.corporate`에 등록됨 (명세의 1-B와 1-C가 일치하는 정상 구현)

## Known Stubs

없음 — 모든 모듈 메타데이터와 도움말 데이터가 완전히 작성됨.

## Threat Flags

없음 — UI 데이터 파일 수정만 포함, 네트워크 엔드포인트나 인증 경로 변경 없음.

## Superpowers 호출 기록

| #   | 스킬명 | 호출 시점 | 결과 요약 |
| --- | ------ | --------- | --------- |
| -   | -      | -         | -         |

### 미호출 스킬 사유

| 스킬명                              | 미호출 사유                                    |
| ----------------------------------- | ---------------------------------------------- |
| superpowers:brainstorming           | 명확한 명세 제공으로 브레인스토밍 불필요       |
| superpowers:test-driven-development | UI 데이터 파일 수정으로 TDD 적용 범위 외       |
| superpowers:systematic-debugging    | 버그 미발생 (Rule 1 수정은 명세에 포함된 작업) |
| superpowers:requesting-code-review  | 데이터 파일 수정으로 코드 리뷰 생략            |

## Self-Check: PASSED

- [x] `apps/web/src/components/settings/model-settings.tsx` — 존재 확인
- [x] `apps/web/src/components/landing/data/domain-help.ts` — 존재 확인
- [x] `apps/web/src/components/advanced/advanced-help.tsx` — 존재 확인
- [x] commit cd7fd39 — 존재 확인
- [x] commit a2e51d7 — 존재 확인
- [x] commit cad047f — 존재 확인
