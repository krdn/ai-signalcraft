# @krdn/ai-analysis-kit 업그레이드 & 신규 프로젝트 연결 가이드

ai-signalcraft 및 신규 프로젝트에서 [`@krdn/ai-analysis-kit`](https://github.com/krdn/ai-analysis-kit)(이하 **kit**)을 안전하게 업그레이드·연결하기 위한 표준 절차.

> **중요**: v2.0.0부터 kit은 **도메인 무관 AI 분석 러너**로 재정비되었다. 12개 정치 여론 분석 모듈·스키마·Stage 상수·`AnalysisInput`은 kit에서 제거되어 ai-signalcraft 내부로 환원되었다. 본 문서는 v2.x 기준이다.

---

## 1. 분리 원칙

| 레이어                     | 위치                          | 내용                                                                                          |
| -------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------- |
| **범용 인프라** (kit)      | `@krdn/ai-analysis-kit`       | AI Gateway, `runModule<TInput, TResult>`, 어댑터 인터페이스, 재시도 유틸, `PROVIDER_REGISTRY` |
| **도메인 자산** (프로젝트) | `packages/core/src/analysis/` | 12개 모듈, Zod 스키마, Stage 1/2/4 상수, `MODULE_MODEL_MAP`, `AnalysisInput`, DB 어댑터       |

kit은 어떤 도메인이든 소비할 수 있도록 입력 타입을 제네릭(`TInput`)으로 둔다. 소비 프로젝트는 자기 `AnalysisModule`을 정의하고 `extractMeta(input) -> { jobId, itemCount }` 콜백으로 메타만 알려주면 된다.

---

## 2. 현재 연결 구조 (ai-signalcraft)

| 위치                                                  | 역할                                                            | kit 의존 방식                                                                          |
| ----------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `packages/core/package.json`                          | `"@krdn/ai-analysis-kit": "github:krdn/ai-analysis-kit#v2.0.0"` | GitHub 태그 고정                                                                       |
| `apps/web/package.json`                               | 동일                                                            | transpilePackages 지원용                                                               |
| `packages/core/src/analysis/modules/`                 | 12개 모듈 (**로컬 정의**)                                       | ❌ kit 사용 안 함                                                                      |
| `packages/core/src/analysis/schemas/`                 | 12개 Zod 스키마 (**로컬 정의**)                                 | ❌ kit 사용 안 함                                                                      |
| `packages/core/src/analysis/types.ts`                 | 로컬 `AnalysisModule`/`AnalysisInput`/`MODULE_MODEL_MAP`        | `AIProvider`만 `kit/gateway`에서 import                                                |
| `packages/core/src/analysis/runner.ts`                | Stage 1/2/4 상수 + kit `runModule` 호출 어댑터                  | `runModule`, `ModelConfigAdapter`, `PipelineControlAdapter`, `RunModuleOptions` (root) |
| `packages/core/src/analysis/pipeline-orchestrator.ts` | Stage 오케스트레이션                                            | 로컬 모듈만 참조                                                                       |
| `packages/core/src/analysis/map-reduce.ts`            | 대량 입력 맵리듀스                                              | `kit/gateway` (`analyzeStructured`, `normalizeUsage`)                                  |
| `packages/core/src/report/generator.ts`               | 리포트 텍스트 생성                                              | `kit/gateway` (`analyzeText`)                                                          |
| `packages/core/src/ai-meta.ts`                        | 브라우저 안전 provider 메타 (인라인)                            | ❌ kit 미사용                                                                          |
| `apps/web/next.config.ts`                             | `@krdn/ai-analysis-kit/gateway`를 `transpilePackages`에 포함    | 브라우저 번들링                                                                        |

→ pnpm이 GitHub 저장소를 직접 빌드해 가져온다 (npm 레지스트리 미사용).

### kit에서 사용하는 심볼 (최종)

```ts
// root
import {
  runModule,
  type ModelConfigAdapter,
  type PipelineControlAdapter,
  type RunModuleOptions,
  type AnalysisModule as KitAnalysisModule,
} from '@krdn/ai-analysis-kit';

// subpath: gateway
import {
  analyzeText,
  analyzeStructured,
  normalizeUsage,
  PROVIDER_REGISTRY,
  AI_PROVIDER_VALUES,
  getProvidersByAccess,
  type AIProvider,
  type AccessMethod,
  type ProviderMeta,
} from '@krdn/ai-analysis-kit/gateway';
```

프로젝트 내 `packages/core/src/analysis/runner.ts`가 로컬 `AnalysisModule`·`AnalysisInput`을 kit 타입으로 캐스팅해 전달한다. 두 타입은 구조적으로 호환되지만 `extractMeta` 콜백은 **필수**다.

---

## 3. 업그레이드 절차

### A. 호환 변경 (minor / patch, v2.x → v2.y)

```bash
# 1. packages/core/package.json 과 apps/web/package.json 두 곳의 태그 변경
#    "@krdn/ai-analysis-kit": "github:krdn/ai-analysis-kit#v2.1.0"

# 2. lockfile 갱신
pnpm install

# 3. 검증
pnpm --filter @ai-signalcraft/core exec tsc --noEmit
pnpm --filter @ai-signalcraft/web exec tsc --noEmit
pnpm --filter @ai-signalcraft/core test
pnpm --filter @ai-signalcraft/core build
pnpm lint
```

### B. Breaking change 포함 업그레이드 (v2 → v3 등)

추가 확인 포인트:

1. **`runner.ts`** — `runModule` / `RunModuleOptions` / `AnalysisModule` 시그니처 변경 여부. v2.0.0은 `<TInput, TResult>` 2-제네릭 + `extractMeta` 필수.
2. **`kit/gateway` exports** — `analyzeText`, `analyzeStructured`, `normalizeUsage`, `PROVIDER_REGISTRY`의 함수 시그니처/반환 타입.
3. **`kit/adapters`** — `ModelConfigAdapter.resolve()` 반환 타입, `PipelineControlAdapter` 메소드 추가/제거.
4. **로컬 모듈과의 타입 호환성** — 로컬 `AnalysisModule<T>`를 kit 타입으로 캐스팅할 때 구조적 일치가 유지되는지 확인.
5. **`apps/web/next.config.ts`** — kit이 새 서브경로를 export하면 `transpilePackages`에 추가.
6. **`ai-meta.ts` 인라인 데이터** — kit의 `PROVIDER_REGISTRY`가 변경되면 `packages/core/src/ai-meta.ts`의 인라인 정의도 동기화 (브라우저 번들 안전성을 위해 re-export 대신 인라인 사용 중).
7. **kit Release Notes / CHANGELOG** 필독.

### C. 로컬 개발 (kit 수정 + 즉시 검증)

루트 `package.json`에 임시 override:

```json
{
  "pnpm": {
    "overrides": {
      "@krdn/ai-analysis-kit": "link:../ai-analysis-kit"
    }
  }
}
```

```bash
pnpm install
# kit 수정 후
(cd ../ai-analysis-kit && pnpm build)
pnpm --filter @ai-signalcraft/core test
```

검증 후 override를 제거하고 태그 버전으로 되돌리는 것을 잊지 말 것.

---

## 4. 신규 프로젝트에서 kit 도입

### Step 1: 의존성 추가

```json
{
  "dependencies": {
    "@krdn/ai-analysis-kit": "github:krdn/ai-analysis-kit#v2.0.0"
  }
}
```

### Step 2: 도메인 타입 정의

```ts
// src/analysis/types.ts
import { z } from 'zod';
import type { AnalysisModule as KitAnalysisModule } from '@krdn/ai-analysis-kit';

export interface MyInput {
  jobId: number;
  records: Array<{ text: string; meta: unknown }>;
  // ... 도메인 고유 필드
}

export type AnalysisModule<T = unknown> = KitAnalysisModule<MyInput, T>;
```

### Step 3: 모듈 작성

```ts
// src/analysis/modules/summarizer.ts
import { z } from 'zod';
import type { AnalysisModule } from '../types';

const SummarySchema = z.object({
  summary: z.string(),
  topics: z.array(z.string()),
});
export type SummaryResult = z.infer<typeof SummarySchema>;

export const summarizerModule: AnalysisModule<SummaryResult> = {
  name: 'summarizer',
  displayName: '요약',
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  schema: SummarySchema,
  buildSystemPrompt: () => '당신은 요약 전문가입니다.',
  buildPrompt: (data) =>
    `다음 ${data.records.length}건을 요약하세요:\n` +
    data.records.map((r, i) => `${i + 1}. ${r.text}`).join('\n'),
};
```

### Step 4: runner 어댑터

```ts
// src/analysis/runner.ts
import {
  runModule as kitRunModule,
  type ModelConfigAdapter,
  type AnalysisModule as KitAnalysisModule,
} from '@krdn/ai-analysis-kit';
import type { MyInput, AnalysisModule } from './types';

const configAdapter: ModelConfigAdapter = {
  async resolve(moduleName) {
    // DB 조회 또는 환경변수 기반 해석
    return {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      apiKey: process.env.ANTHROPIC_API_KEY,
    };
  },
};

export async function runModule<T>(
  module: AnalysisModule<T>,
  input: MyInput,
  priorResults?: Record<string, unknown>,
) {
  return kitRunModule<MyInput, T>(
    module as unknown as KitAnalysisModule<MyInput, T>,
    input,
    {
      configAdapter,
      extractMeta: (i) => ({
        jobId: i.jobId,
        itemCount: i.records.length,
      }),
      // 선택: pipelineControl, onPersist, onProgress
    },
    priorResults,
  );
}
```

### Step 5: Next.js 프로젝트에서 transpilePackages

```ts
// next.config.ts
export default {
  transpilePackages: ['@krdn/ai-analysis-kit/gateway'],
};
```

---

## 5. v1.x → v2.0.0 마이그레이션 요약

이미 v1.x를 쓰던 프로젝트가 v2로 올릴 때:

| v1.x 사용 지점                                                             | v2.0.0 대응                                                                                                                          |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `@krdn/ai-analysis-kit/modules`에서 12개 모듈 import                       | 로컬 `src/analysis/modules/`로 이전 (ai-signalcraft는 `61a493e^`에서 환원한 파일 사용)                                               |
| `@krdn/ai-analysis-kit/schemas`에서 스키마 import                          | 로컬 `src/analysis/schemas/`로 이전                                                                                                  |
| `STAGE1_MODULES` ~ `STAGE4_SEQUENTIAL`, `ALL_MODULES`, `getModuleByName()` | 로컬 `runner.ts`에서 재정의                                                                                                          |
| `MODULE_MODEL_MAP`, `MODULE_NAMES`                                         | 로컬 `types.ts`로 이전                                                                                                               |
| `AnalysisInput`                                                            | 로컬 타입으로 이전 (도메인 필드 자유)                                                                                                |
| `runModule<T>(module, input, options)`                                     | `runModule<TInput, T>(module, input, { ...options, extractMeta })`                                                                   |
| `createInMemoryModelConfig({ overrides, providerDefaults })`               | `createInMemoryModelConfig({ modules: { 'mod-name': { provider, model } }, overrides, providerDefaults })` — `modules` 매핑 **필수** |
| CLI `ai-analysis run <module>`                                             | **v2에서 제거됨**. 필요하면 프로젝트 내부에 자체 CLI 작성                                                                            |

### ai-signalcraft의 실제 마이그레이션 커밋

- `61a493e` — v1.0.0으로 kit 분리 (시점 기준)
- `39d135e` — v2.0.0 적용 + 12개 모듈 환원

---

## 6. 트러블슈팅

| 증상                                                       | 원인                                                                | 해결                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------- |
| `Missing "./modules" specifier in "@krdn/ai-analysis-kit"` | v2.0.0에서 `./modules` 서브경로 제거됨                              | import를 로컬 경로(`../src/analysis/modules`)로 변경    |
| `TS2724: no exported member 'AnalysisInput'`               | v2에서 `AnalysisInput` 제거됨                                       | 로컬 `types.ts`에 정의하거나 기존 정의 사용             |
| `TS2558: Expected 2 type arguments, but got 1`             | `AnalysisModule<T>` → `AnalysisModule<TInput, TResult>` 제네릭 확장 | 2-제네릭으로 수정                                       |
| `runModule` 호출 시 `extractMeta` 누락 에러                | v2에서 필수 옵션                                                    | `extractMeta: (i) => ({ jobId, itemCount })` 추가       |
| 브라우저 번들에 `node:v8` / OpenTelemetry 포함             | `kit/gateway` barrel이 Node 전용 의존성 끌어옴                      | `ai-meta.ts`처럼 필요한 타입/상수만 인라인 정의         |
| `Missing "modules" in createInMemoryModelConfig`           | v2에서 `modules` 옵션 필수화                                        | `{ modules: { 'mod-name': { provider, model } } }` 전달 |

---

## 7. 관련 문서

- kit 저장소: https://github.com/krdn/ai-analysis-kit
- kit CHANGELOG: https://github.com/krdn/ai-analysis-kit/blob/main/CHANGELOG.md
- 본 프로젝트 분석 모듈: `packages/core/src/analysis/modules/`
- 본 프로젝트 분석 러너: `packages/core/src/analysis/runner.ts`
