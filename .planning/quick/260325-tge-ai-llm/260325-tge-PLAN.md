---
phase: quick
plan: 260325-tge
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/core/src/db/schema/settings.ts
  - packages/core/src/db/schema/index.ts
  - packages/core/src/analysis/model-config.ts
  - packages/core/src/analysis/index.ts
  - packages/core/src/analysis/runner.ts
  - packages/core/src/index.ts
  - apps/web/src/server/trpc/routers/settings.ts
  - apps/web/src/server/trpc/router.ts
  - apps/web/src/components/settings/model-settings.tsx
  - apps/web/src/components/layout/top-nav.tsx
autonomous: true
must_haves:
  truths:
    - '사용자가 설정 UI에서 12개 모듈 각각의 AI 프로바이더와 모델을 변경할 수 있다'
    - '변경된 설정이 DB에 저장되고, 분석 실행 시 DB 설정이 우선 적용된다'
    - 'DB에 설정이 없는 모듈은 MODULE_MODEL_MAP 기본값으로 동작한다'
  artifacts:
    - path: 'packages/core/src/db/schema/settings.ts'
      provides: 'model_settings 테이블 스키마'
      contains: 'modelSettings'
    - path: 'packages/core/src/analysis/model-config.ts'
      provides: 'DB 조회 + 기본값 폴백 함수'
      exports: ['getModuleModelConfig', 'getAllModelSettings']
    - path: 'apps/web/src/server/trpc/routers/settings.ts'
      provides: 'settings tRPC 라우터 (list, update)'
      exports: ['settingsRouter']
    - path: 'apps/web/src/components/settings/model-settings.tsx'
      provides: '모듈별 모델 설정 UI 컴포넌트'
  key_links:
    - from: 'packages/core/src/analysis/runner.ts'
      to: 'model-config.ts -> DB'
      via: 'runModule에서 getModuleModelConfig() 호출'
      pattern: 'getModuleModelConfig'
    - from: 'apps/web/src/components/settings/model-settings.tsx'
      to: '/api/trpc/settings.*'
      via: 'tRPC client hooks'
      pattern: "trpc\\.settings\\."
---

<objective>
웹 대시보드에서 12개 분석 모듈 각각의 AI 프로바이더(anthropic/openai)와 모델을 개별 설정할 수 있는 기능 추가.

Purpose: 현재 하드코딩된 MODULE_MODEL_MAP을 DB 기반 동적 설정으로 전환하여, 모델 변경 시 코드 수정/재배포 없이 웹에서 즉시 변경 가능하게 한다.
Output: DB 테이블 + Core 조회 함수 + tRPC API + 설정 UI 다이얼로그
</objective>

<execution_context>
@.planning/quick/260325-tge-ai-llm/260325-tge-PLAN.md
</execution_context>

<context>
@packages/core/src/analysis/types.ts (MODULE_MODEL_MAP, AIProvider, AnalysisModule 인터페이스)
@packages/core/src/analysis/runner.ts (runModule - module.provider/model 사용 지점)
@packages/core/src/db/schema/analysis.ts (기존 Drizzle 스키마 패턴 참고)
@apps/web/src/server/trpc/router.ts (appRouter 구성)
@apps/web/src/server/trpc/init.ts (protectedProcedure, router 헬퍼)
@apps/web/src/components/layout/top-nav.tsx (기어 아이콘 추가 위치)

<interfaces>
<!-- 핵심 타입과 함수 시그니처 -->

From packages/core/src/analysis/types.ts:

```typescript
export type AIProvider = 'anthropic' | 'openai';

export const MODULE_MODEL_MAP: Record<string, { provider: AIProvider; model: string }> = {
  'macro-view': { provider: 'openai', model: 'gpt-4o-mini' },
  // ... 12 modules total
};
```

From packages/core/src/db/schema/analysis.ts (패턴):

```typescript
import { pgTable, text, timestamp, integer, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
// identity column: integer('id').primaryKey().generatedAlwaysAsIdentity()
// timestamp: timestamp('...').defaultNow().notNull()
```

From apps/web/src/server/trpc/init.ts:

```typescript
export const router: typeof t.router;
export const protectedProcedure: typeof t.procedure; // 인증 + teamId 주입
// ctx: { session, db, teamId }
```

From apps/web/src/server/trpc/router.ts:

```typescript
export const appRouter = router({
  analysis: analysisRouter,
  pipeline: pipelineRouter,
  // ... 6개 라우터
});
```

From runner.ts (수정 대상):

```typescript
export async function runModule<T>(
  module: AnalysisModule<T>,
  input: AnalysisInput,
  priorResults?: Record<string, unknown>,
): Promise<AnalysisModuleResult<T>> {
  // module.provider, module.model을 직접 사용 중
  const result = await analyzeStructured(prompt, module.schema, {
    provider: module.provider,
    model: module.model,
    // ...
  });
}
```

</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: DB 스키마 + Core 모델 설정 조회 함수</name>
  <files>
    packages/core/src/db/schema/settings.ts,
    packages/core/src/db/schema/index.ts,
    packages/core/src/analysis/model-config.ts,
    packages/core/src/analysis/index.ts,
    packages/core/src/analysis/runner.ts,
    packages/core/src/index.ts
  </files>
  <action>
    1. `packages/core/src/db/schema/settings.ts` 생성:
       - `modelSettings` 테이블: id(identity), moduleName(text, unique), provider(text, 'anthropic'|'openai'), model(text), updatedAt(timestamp)
       - Drizzle 패턴은 기존 analysis.ts 참고 (pgTable, integer identity, timestamp defaultNow)

    2. `packages/core/src/db/schema/index.ts`에 `export * from './settings'` 추가

    3. `packages/core/src/analysis/model-config.ts` 생성:
       - `getModuleModelConfig(moduleName: string)`: DB에서 해당 모듈 설정 조회, 없으면 MODULE_MODEL_MAP[moduleName] 기본값 반환. `{ provider: AIProvider; model: string }` 반환.
       - `getAllModelSettings()`: 12개 모듈 전체 설정 반환. DB 설정을 MODULE_MODEL_MAP에 머지하여 반환. 반환 타입: `Array<{ moduleName: string; provider: AIProvider; model: string; isCustom: boolean }>`. isCustom=true이면 DB 설정, false이면 기본값.
       - `upsertModelSetting(moduleName: string, provider: AIProvider, model: string)`: DB에 upsert (onConflictDoUpdate on moduleName).
       - db import는 `import { db } from '../db'` 사용

    4. `packages/core/src/analysis/index.ts`에 `export * from './model-config'` 추가

    5. `packages/core/src/analysis/runner.ts`의 `runModule` 함수 수정:
       - 함수 시작 부분에서 `const config = await getModuleModelConfig(module.name)` 호출
       - `analyzeStructured` 호출 시 `module.provider` -> `config.provider`, `module.model` -> `config.model` 로 교체
       - usage 기록 시에도 동일하게 `config.provider`, `config.model` 사용

    6. `packages/core/src/index.ts`는 이미 `export * from './analysis'`가 있으므로 model-config가 자동 export됨. `export * from './db/schema'`도 있으므로 modelSettings도 자동 export됨. 추가 작업 불필요.

    주의: getModuleModelConfig는 분석 실행 시점에 매번 DB를 조회한다. 12개 모듈이 순차/병렬로 실행되므로 12번 조회되지만, 분석 1회 실행당 호출이므로 성능 이슈 없음. 캐싱 불필요.

  </action>
  <verify>
    cd /home/gon/projects/ai/ai-signalcraft && pnpm -F @ai-signalcraft/core exec tsc --noEmit
  </verify>
  <done>
    - modelSettings 테이블 스키마가 정의되고 schema/index.ts에서 export됨
    - getModuleModelConfig, getAllModelSettings, upsertModelSetting 함수가 타입 체크 통과
    - runner.ts의 runModule이 DB 설정을 우선 사용하도록 변경됨
  </done>
</task>

<task type="auto">
  <name>Task 2: tRPC 라우터 + 설정 UI 다이얼로그</name>
  <files>
    apps/web/src/server/trpc/routers/settings.ts,
    apps/web/src/server/trpc/router.ts,
    apps/web/src/components/settings/model-settings.tsx,
    apps/web/src/components/layout/top-nav.tsx
  </files>
  <action>
    1. `apps/web/src/server/trpc/routers/settings.ts` 생성:
       - `settingsRouter = router({...})` 패턴 (기존 team.ts 등 참고)
       - `list`: protectedProcedure, no input. `getAllModelSettings()` 호출하여 12개 모듈 설정 반환
       - `update`: protectedProcedure, input: `{ moduleName: string, provider: 'anthropic'|'openai', model: string }` (Zod 검증). `upsertModelSetting()` 호출. 성공 시 updated 설정 반환.
       - `resetToDefault`: protectedProcedure, input: `{ moduleName: string }`. DB에서 해당 모듈 설정 삭제 (delete where moduleName). 기본값 복원 효과.
       - import: `getAllModelSettings`, `upsertModelSetting`, `modelSettings` from `@ai-signalcraft/core`
       - delete용: `import { eq } from 'drizzle-orm'`

    2. `apps/web/src/server/trpc/router.ts` 수정:
       - `import { settingsRouter } from './routers/settings'` 추가
       - appRouter에 `settings: settingsRouter` 추가

    3. `apps/web/src/components/settings/model-settings.tsx` 생성 ('use client'):
       - tRPC hooks로 `trpc.settings.list.useQuery()` 사용
       - 12개 모듈을 카드/리스트로 표시. 각 모듈마다:
         - 모듈명 (MODULE_MODEL_MAP의 키를 displayName으로 매핑 -- 한국어명 하드코딩 또는 모듈 목록에서 가져오기)
         - Provider 선택: Select 컴포넌트 (anthropic / openai)
         - Model 입력: 프로바이더별 모델 목록을 Select로 제공
           - anthropic: 'claude-sonnet-4-20250514', 'claude-haiku-35-20241022'
           - openai: 'gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1-nano'
         - isCustom=true이면 "사용자 설정" 뱃지 표시 + "기본값 복원" 버튼
       - 변경 시 `trpc.settings.update.useMutation()` 호출, 성공 시 list 쿼리 invalidate
       - 기본값 복원 시 `trpc.settings.resetToDefault.useMutation()` 호출
       - shadcn/ui 컴포넌트 사용: Select, Badge, Button, Card
       - 로딩/에러 상태 처리

    4. `apps/web/src/components/layout/top-nav.tsx` 수정:
       - lucide-react에서 `Settings` 아이콘 import 추가
       - 사용자 아바타 왼쪽에 기어(Settings) 아이콘 버튼 추가
       - 클릭 시 Dialog 열림 (기존 팀 설정 Dialog 패턴과 동일)
       - Dialog 내부에 `<ModelSettings />` 컴포넌트 렌더링
       - DialogTitle: "AI 모델 설정"

    모듈 displayName 매핑 (model-settings.tsx 내부 상수로 정의):
    ```
    macro-view -> 전체 여론 구조 분석
    segmentation -> 여론 진영 세분화
    sentiment-framing -> 감정 프레이밍 분석
    message-impact -> 메시지 임팩트 분석
    risk-map -> 리스크 맵
    opportunity -> 기회 요소 분석
    strategy -> 전략 제안
    final-summary -> 최종 요약
    integrated-report -> 종합 리포트
    approval-rating -> 지지율 예측
    frame-war -> 프레임 전쟁 분석
    crisis-scenario -> 위기 시나리오
    win-simulation -> 승리 시뮬레이션
    ```

  </action>
  <verify>
    cd /home/gon/projects/ai/ai-signalcraft && pnpm build
  </verify>
  <done>
    - settings tRPC 라우터가 list/update/resetToDefault 엔드포인트를 제공함
    - 탑 네비게이션에 기어 아이콘이 표시되고, 클릭하면 AI 모델 설정 다이얼로그가 열림
    - 다이얼로그에서 12개 모듈의 프로바이더/모델을 개별 변경 가능
    - 변경사항이 DB에 저장되고, 기본값 복원 기능 동작
  </done>
</task>

<task type="auto">
  <name>Task 3: DB 마이그레이션 실행 (drizzle-kit push)</name>
  <files>packages/core/drizzle.config.ts</files>
  <action>
    로컬 개발 DB에 model_settings 테이블 생성:
    ```
    cd packages/core && pnpm drizzle-kit push
    ```
    drizzle-kit push는 스키마 diff를 감지하여 model_settings 테이블을 자동 생성한다.
    drizzle.config.ts는 이미 존재하므로 추가 설정 불필요.

    push 후 테이블 생성 확인:
    ```
    psql로 접속하여 \dt model_settings 또는 SELECT * FROM model_settings LIMIT 1 실행
    ```

    주의: 운영 서버(192.168.0.5:5433) DB push는 별도 작업. 이 태스크는 로컬/개발 DB만 대상.

  </action>
  <verify>
    cd /home/gon/projects/ai/ai-signalcraft/packages/core && pnpm drizzle-kit push --force 2>&1 | tail -5
  </verify>
  <done>
    - model_settings 테이블이 개발 DB에 생성됨
    - 테이블 구조: id(serial), module_name(text unique), provider(text), model(text), updated_at(timestamp)
  </done>
</task>

</tasks>

<verification>
1. `pnpm build` -- 전체 빌드 성공
2. 웹 앱 실행 후 탑내비 기어 아이콘 클릭 -> 설정 다이얼로그 열림
3. 모듈 하나의 프로바이더/모델 변경 -> DB 저장 확인
4. 분석 실행 시 변경된 모델로 호출되는지 확인 (usage 로그)
</verification>

<success_criteria>

- 12개 모듈 각각의 AI 프로바이더/모델을 웹 UI에서 변경 가능
- 변경 사항이 DB에 영속되고, 분석 실행 시 DB 설정이 우선 적용됨
- DB 설정이 없으면 기존 MODULE_MODEL_MAP 기본값으로 폴백
- 기본값 복원 기능 동작
  </success_criteria>

<output>
After completion, create `.planning/quick/260325-tge-ai-llm/260325-tge-SUMMARY.md`
</output>
