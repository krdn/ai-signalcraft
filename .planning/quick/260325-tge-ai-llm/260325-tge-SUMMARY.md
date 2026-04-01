---
phase: quick
plan: 260325-tge
subsystem: analysis, settings
tags: [ai-model, settings, trpc, ui]
dependency_graph:
  requires: [db-schema, trpc-router]
  provides: [model-settings-ui, dynamic-model-config]
  affects: [analysis-runner, top-nav]
tech_stack:
  added: []
  patterns: [drizzle-upsert, trpc-vanilla-client, base-ui-select]
key_files:
  created:
    - packages/core/src/db/schema/settings.ts
    - packages/core/src/analysis/model-config.ts
    - apps/web/src/server/trpc/routers/settings.ts
    - apps/web/src/components/settings/model-settings.tsx
  modified:
    - packages/core/src/db/schema/index.ts
    - packages/core/src/analysis/index.ts
    - packages/core/src/analysis/runner.ts
    - apps/web/src/server/trpc/router.ts
    - apps/web/src/components/layout/top-nav.tsx
decisions:
  - 'getDb() lazy 초기화 사용 -- Worker 프로세스 호환'
  - '분석 실행 시 매번 DB 조회 (캐싱 불필요 -- 분석 1회당 13회 조회)'
  - 'base-ui Select의 onValueChange가 string|null 반환 -- null 가드 추가'
metrics:
  duration: 5min
  completed: '2026-03-25T12:22:19Z'
---

# Quick Task 260325-tge: AI 모델 설정 UI Summary

DB 기반 동적 AI 모델 설정으로 전환 -- 13개 분석 모듈의 프로바이더/모델을 웹 UI에서 즉시 변경 가능, DB 설정 없으면 MODULE_MODEL_MAP 기본값 폴백

## Completed Tasks

| Task | Name                                 | Commit    | Files                                            |
| ---- | ------------------------------------ | --------- | ------------------------------------------------ |
| 1    | DB 스키마 + Core 모델 설정 조회 함수 | 3a2d359   | settings.ts, model-config.ts, runner.ts          |
| 2    | tRPC 라우터 + 설정 UI 다이얼로그     | e083269   | settings router, model-settings.tsx, top-nav.tsx |
| 3    | DB 마이그레이션 실행                 | (runtime) | model_settings 테이블 생성 완료                  |

## Key Implementation Details

### DB 스키마 (model_settings)

- `id` (identity), `module_name` (text, unique), `provider` (text), `model` (text), `updated_at` (timestamp)
- Drizzle ORM 패턴 준수 -- pgTable, generatedAlwaysAsIdentity, uniqueIndex

### Core 함수

- `getModuleModelConfig(moduleName)`: DB 우선 조회, MODULE_MODEL_MAP 폴백
- `getAllModelSettings()`: 13개 모듈 전체 설정 + isCustom 플래그
- `upsertModelSetting()`: onConflictDoUpdate on moduleName

### runner.ts 변경

- `runModule()` 시작 시 `getModuleModelConfig(module.name)` 호출
- `module.provider/model` 대신 `config.provider/config.model` 사용

### UI

- top-nav에 Settings(기어) 아이콘 추가 -- Dialog로 ModelSettings 렌더링
- 13개 모듈 카드: 프로바이더 Select + 모델 Select
- 사용자 설정 뱃지, 기본값 복원 버튼
- TanStack Query + trpcClient 패턴 (프로젝트 기존 패턴 준수)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] base-ui Select onValueChange 타입 불일치**

- **Found during:** Task 2 (빌드 검증)
- **Issue:** base-ui의 Select `onValueChange`가 `string | null`을 반환하는데 handler가 `string`만 받도록 되어 있어 타입 에러
- **Fix:** handler 파라미터를 `string | null`로 변경하고 null 가드 추가
- **Files modified:** apps/web/src/components/settings/model-settings.tsx

## Known Stubs

None -- 모든 데이터 소스가 실제 DB와 연결되어 동작.

## Superpowers 호출 기록

| #   | 스킬명 | 호출 시점 | 결과 요약                                           |
| --- | ------ | --------- | --------------------------------------------------- |
| -   | -      | -         | Quick task -- Superpowers 스킬 미호출 (소규모 작업) |

### 미호출 스킬 사유

| 스킬명                              | 미호출 사유                        |
| ----------------------------------- | ---------------------------------- |
| superpowers:brainstorming           | Quick task, 요구사항 명확          |
| superpowers:test-driven-development | 설정 CRUD -- 단위 테스트 대상 아님 |
| superpowers:systematic-debugging    | 버그 1건은 타입 에러로 즉시 수정   |
| superpowers:requesting-code-review  | Quick task 범위                    |

## Self-Check: PASSED

- All 4 created files: FOUND
- Commit 3a2d359 (Task 1): FOUND
- Commit e083269 (Task 2): FOUND
- model_settings table in DB: VERIFIED
