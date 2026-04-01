# Phase 9: 타입 & 테스트 강화 - Research

**Researched:** 2026-03-27
**Domain:** TypeScript 타입 리팩토링, Vitest 단위 테스트, 테스트 파일 분할
**Confidence:** HIGH

## Summary

Phase 9는 기능 변경 없는 순수 리팩토링이다. (1) 5곳에 분산된 인라인 타입을 패키지별 types/ 디렉토리로 중앙화하고, (2) ai-gateway 패키지에 vi.mock 기반 단위 테스트를 추가하며, (3) 300줄인 advn-schema.test.ts를 describe 블록 단위로 분할한다. 코드베이스 탐색 결과 types/ 중앙화 패턴이 이미 core와 collectors 패키지에 존재하므로 동일 패턴을 적용하면 된다.

주요 리스크는 타입 이동 시 barrel export 체인이 깨지는 것이다. 현재 `packages/core/src/analysis/index.ts`가 `export * from './types'`로 모든 분석 타입을 re-export하고 있어, 타입을 types/ 디렉토리로 이동한 후에도 이 barrel export가 올바르게 연결되어야 한다. AIProvider 중복 제거 시 core가 ai-gateway에서 import하게 되는데, 이미 core가 ai-gateway에 의존하고 있으므로 순환 의존 문제는 없다.

**Primary recommendation:** 타입 이동 -> barrel export 업데이트 -> ai-gateway 테스트 -> 테스트 분할 순서로 진행. 매 단계마다 `pnpm -r test`로 기존 테스트 통과를 확인한다.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Zod schema와 co-located된 타입(z.infer Result 타입)은 schema 파일에 유지 -- 12개 schema 파일의 Result 타입은 이동하지 않음
- **D-02:** 인라인 interface/type alias를 해당 패키지의 types/ 디렉토리로 이동
- **D-03:** 기존 barrel export(index.ts) 패턴 유지하여 외부 import 경로 호환성 보장 (Phase 8 D-06 계승)
- **D-04:** AIProvider 타입은 ai-gateway에서 단일 정의, core가 ai-gateway에서 import
- **D-05:** 공유 타입 패키지(packages/shared) 만들지 않음
- **D-06:** vi.mock('ai')로 generateText/generateObject mock하여 AI 호출 없이 테스트
- **D-07:** getModel, analyzeText, analyzeStructured 단위 테스트 작성
- **D-08:** 300줄 초과 테스트 파일만 분할 대상 (advn-schema.test.ts)
- **D-09:** 분할 기준은 모듈/describe 블록 단위

### Claude's Discretion

- types/ 디렉토리 내 파일 분류 방식 (analysis.ts, pipeline.ts, report.ts 등 또는 단일 index.ts)
- ai-gateway 테스트 파일 위치 및 구조
- advn-schema.test.ts 분할 시 정확한 경계점

### Deferred Ideas (OUT OF SCOPE)

None
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                      | Research Support                                                                                |
| ------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| TYPE-01 | 분산된 타입 정의(5곳)를 패키지별 types/로 중앙화 | 이동 대상 5개 타입, 기존 types/ 패턴, barrel export 체인 모두 분석 완료                         |
| TYPE-02 | ai-gateway 패키지에 기본 테스트 추가 (현재 0%)   | gateway.ts 112줄 분석 완료. getModel/analyzeText/analyzeStructured 테스트 전략 수립             |
| TYPE-03 | 300줄 이상 테스트 파일을 모듈별로 분할           | advn-schema.test.ts의 5개 describe 블록 경계 분석 완료                                          |
| TYPE-04 | 모든 패키지의 기존 테스트가 통과                 | 현재 테스트 상태 확인 완료 -- analysis-runner.test.ts와 report.test.ts에 DB 관련 사전 실패 존재 |

</phase_requirements>

## Standard Stack

### Core

| Library    | Version | Purpose           | Why Standard                                                            |
| ---------- | ------- | ----------------- | ----------------------------------------------------------------------- |
| Vitest     | 3.2.4   | 테스트 프레임워크 | 프로젝트 전체에서 이미 사용 중. ai-gateway에 vitest.config.ts 이미 존재 |
| TypeScript | 5.x     | 타입 시스템       | 프로젝트 기본 언어                                                      |

### Supporting

| Library | Version       | Purpose   | When to Use                            |
| ------- | ------------- | --------- | -------------------------------------- |
| vi.mock | (Vitest 내장) | 모듈 모킹 | ai-gateway 테스트에서 'ai' 패키지 mock |

**Installation:** 추가 패키지 설치 불필요. ai-gateway의 vitest는 pnpm 워크스페이스 hoisting으로 이미 사용 가능.

## Architecture Patterns

### TYPE-01: 타입 중앙화 패턴

#### 이동 대상 타입 목록 (5곳)

| 현재 위치                            | 타입                  | 이동 후 위치                  |
| ------------------------------------ | --------------------- | ----------------------------- |
| `core/src/analysis/types.ts`         | AIProvider (중복)     | 제거 -- ai-gateway에서 import |
| `core/src/analysis/model-config.ts`  | ModuleModelConfig     | `core/src/types/analysis.ts`  |
| `core/src/analysis/provider-keys.ts` | ProviderKeyInfo       | `core/src/types/analysis.ts`  |
| `core/src/report/generator.ts`       | ReportGenerationInput | `core/src/types/report.ts`    |
| `core/src/report/pdf-exporter.ts`    | PdfExportOptions      | `core/src/types/report.ts`    |
| `core/src/pipeline/normalize.ts`     | CommunitySource       | `core/src/types/pipeline.ts`  |

#### 기존 types/ 패턴 (이미 확립됨)

```typescript
// packages/core/src/types/index.ts -- 현재 패턴
import { z } from 'zod';

export const CollectionTriggerSchema = z.object({ ... });
export type CollectionTrigger = z.infer<typeof CollectionTriggerSchema>;
export type SourceStatus = { ... };
export type JobProgress = Record<string, SourceStatus>;
```

**권장 구조:** types/ 디렉토리 내 파일을 도메인별로 분류하고 index.ts에서 re-export.

```
packages/core/src/types/
├── index.ts          # 기존 + 새 파일 re-export
├── analysis.ts       # ModuleModelConfig, ProviderKeyInfo
├── report.ts         # ReportGenerationInput, PdfExportOptions
└── pipeline.ts       # CommunitySource
```

#### Barrel Export 체인 (호환성 유지 필수)

현재 import 체인:

```
외부 -> @ai-signalcraft/core -> core/src/index.ts -> core/src/analysis/index.ts -> core/src/analysis/types.ts
```

타입 이동 후에도 `core/src/analysis/index.ts`와 `core/src/index.ts`의 re-export를 통해 동일한 외부 import 경로 유지.

#### AIProvider 중복 제거 흐름

```
현재:
  ai-gateway/src/gateway.ts  ->  export type AIProvider = '...'
  core/src/analysis/types.ts ->  export type AIProvider = '...'  (중복!)

이후:
  ai-gateway/src/gateway.ts  ->  export type AIProvider = '...'  (단일 소스)
  core/src/analysis/types.ts ->  export type { AIProvider } from '@ai-signalcraft/ai-gateway'  (re-export)
```

**중요:** `core/src/analysis/types.ts`에서 AIProvider를 re-export해야 `core/src/analysis/index.ts` -> `core/src/index.ts` 체인이 유지됨. 단순 삭제하면 `@ai-signalcraft/core`에서 AIProvider를 import하던 코드가 깨질 수 있음.

현재 AIProvider를 core에서 직접 import하는 파일:

- `core/src/analysis/model-config.ts` -- `import type { AIProvider } from './types'`

### TYPE-02: ai-gateway 테스트 패턴

#### getModel 테스트 전략

`getModel`은 export되지 않은 내부 함수이므로 직접 테스트 불가. `analyzeText`/`analyzeStructured`를 통해 간접 테스트하거나, 테스트를 위해 export하는 방법이 있다.

**권장:** getModel을 named export로 변경하여 직접 테스트. gateway.ts가 112줄로 작은 모듈이므로 내부 구현 테스트가 적절.

#### vi.mock 패턴

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 'ai' 패키지 mock
vi.mock('ai', () => ({
  generateText: vi.fn(),
  generateObject: vi.fn(),
}));

// '@ai-sdk/anthropic', '@ai-sdk/openai' mock
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => vi.fn(() => 'mock-anthropic-model')),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => {
    const fn = vi.fn(() => 'mock-openai-model');
    fn.chat = vi.fn(() => 'mock-openai-chat-model');
    return fn;
  }),
}));

import { generateText, generateObject } from 'ai';
import { analyzeText, analyzeStructured } from '../src/gateway';
```

#### 테스트 케이스

1. **getModel 프로바이더 라우팅:** anthropic -> createAnthropic, openai -> createOpenAI, ollama/deepseek/xai/openrouter/custom -> createOpenAI.chat
2. **getModel baseUrl 정규화:** trailing slash 제거, `/v1` 자동 추가
3. **getModel 기본값:** provider별 기본 모델, 기본 baseUrl
4. **analyzeText:** options 전달 검증 (systemPrompt, maxOutputTokens), 반환 형태 확인
5. **analyzeStructured:** schema 전달 검증, 반환 형태 확인

### TYPE-03: advn-schema.test.ts 분할

현재 구조 (300줄, 5개 describe 블록):

| Describe                      | 줄 범위 | 줄 수 | 파일명 제안                  |
| ----------------------------- | ------- | ----- | ---------------------------- |
| ADVN-01: ApprovalRatingSchema | 4-75    | 72    | advn-approval-rating.test.ts |
| ADVN-02: FrameWarSchema       | 77-126  | 50    | advn-frame-war.test.ts       |
| ADVN-03: CrisisScenarioSchema | 128-186 | 59    | advn-crisis-scenario.test.ts |
| ADVN-04: WinSimulationSchema  | 188-263 | 76    | advn-win-simulation.test.ts  |
| ADVN 모듈 export 확인         | 265-300 | 36    | advn-exports.test.ts         |

**권장 분할:** 5개 파일로 분할하면 각 파일이 35~76줄로 300줄 이하 요건을 충족. 공통 import는 `import { describe, it, expect } from 'vitest'; import { ZodError } from 'zod';` 뿐이므로 공유 fixture 불필요.

### Anti-Patterns to Avoid

- **import 경로 직접 변경만 하고 barrel export 미갱신:** 외부 패키지에서 `@ai-signalcraft/core` import가 깨짐
- **AIProvider 단순 삭제:** re-export 없이 삭제하면 core에서 AIProvider를 export하던 코드 깨짐
- **getModel을 export하지 않고 테스트 시도:** 불필요하게 복잡한 간접 테스트가 됨

## Don't Hand-Roll

| Problem          | Don't Build            | Use Instead                        | Why                                   |
| ---------------- | ---------------------- | ---------------------------------- | ------------------------------------- |
| AI SDK mock      | 실제 AI 호출 mock 로직 | vi.mock('ai') + vi.fn()            | Vitest 내장 모킹으로 충분             |
| 타입 import 분석 | 수동 grep              | TypeScript compiler (tsc --noEmit) | 컴파일 에러로 누락된 import 자동 감지 |

## Common Pitfalls

### Pitfall 1: Barrel Export 체인 단절

**What goes wrong:** 타입을 이동한 후 중간 barrel export를 갱신하지 않아 외부 import 실패
**Why it happens:** core/src/types/index.ts에 새 파일을 추가했지만 core/src/analysis/index.ts의 re-export를 업데이트하지 않음
**How to avoid:** 타입 이동 후 `pnpm -r build` (tsc)로 컴파일 에러 확인
**Warning signs:** `Module has no exported member` TypeScript 에러

### Pitfall 2: AIProvider Re-export 누락

**What goes wrong:** core/analysis/types.ts에서 AIProvider를 삭제만 하고 ai-gateway re-export를 추가하지 않음
**Why it happens:** D-04는 "core가 ai-gateway에서 import"이지만, core 자체의 export API도 유지해야 함
**How to avoid:** core/src/analysis/types.ts에 `export type { AIProvider } from '@ai-signalcraft/ai-gateway'` 추가
**Warning signs:** ProviderType alias도 함께 re-export해야 함

### Pitfall 3: vi.mock 호이스팅 순서

**What goes wrong:** vi.mock이 import 뒤에 위치하면 mock이 적용되지 않음
**Why it happens:** Vitest는 vi.mock을 자동으로 파일 최상단으로 호이스팅하지만, factory 함수 내에서 외부 변수 참조 시 문제 발생
**How to avoid:** vi.mock()을 파일 최상단에 배치, factory 함수 내에서 import 사용 시 vi.hoisted() 활용
**Warning signs:** mock이 무시되고 실제 모듈이 호출됨

### Pitfall 4: 사전 실패 테스트를 Phase 9 실패로 오인

**What goes wrong:** analysis-runner.test.ts(4개)와 report.test.ts(2개)가 DB mock 부재로 이미 실패 중인데 Phase 9에서 도입한 문제로 착각
**Why it happens:** getModuleModelConfig가 실제 DB 연결을 필요로 하나 mock이 없음
**How to avoid:** TYPE-04 검증 시 Phase 9 변경 전후의 테스트 결과를 비교. 사전 실패 6개는 Phase 9 범위 밖
**Warning signs:** `Cannot read properties of undefined` DB 관련 에러

## Code Examples

### 타입 이동 후 barrel export 패턴

```typescript
// packages/core/src/types/analysis.ts (신규)
export interface ModuleModelConfig {
  provider: AIProvider;
  model: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface ProviderKeyInfo {
  id: number;
  providerName: string;
  // ... 나머지 필드
}
```

```typescript
// packages/core/src/types/index.ts (기존 + 추가)
// 기존 exports 유지
export * from './analysis'; // 신규 추가
export * from './report'; // 신규 추가
export * from './pipeline'; // 신규 추가
```

### ai-gateway 테스트 mock 패턴

```typescript
// packages/ai-gateway/tests/gateway.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const mockGenerateText = vi.fn();
const mockGenerateObject = vi.fn();

vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
}));

const mockCreateAnthropic = vi.fn();
const mockCreateOpenAI = vi.fn();

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: (...args: unknown[]) => mockCreateAnthropic(...args),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: (...args: unknown[]) => mockCreateOpenAI(...args),
}));

import { analyzeText, analyzeStructured, getModel } from '../src/gateway';

describe('getModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAnthropic.mockReturnValue(vi.fn(() => 'anthropic-model'));
    const openaiClient = vi.fn(() => 'openai-model');
    (openaiClient as any).chat = vi.fn(() => 'openai-chat-model');
    mockCreateOpenAI.mockReturnValue(openaiClient);
  });

  it('anthropic 프로바이더에 createAnthropic 호출', () => {
    getModel('anthropic');
    expect(mockCreateAnthropic).toHaveBeenCalled();
  });
});
```

### 테스트 파일 분할 패턴

```typescript
// packages/core/tests/advn-approval-rating.test.ts (분할 후)
import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';

describe('ADVN-01: ApprovalRatingSchema', () => {
  // ... 기존 테스트 그대로 이동
});
```

## Validation Architecture

### Test Framework

| Property           | Value                                     |
| ------------------ | ----------------------------------------- |
| Framework          | Vitest 3.2.4                              |
| Config file        | 각 패키지별 vitest.config.ts              |
| Quick run command  | `pnpm --filter @ai-signalcraft/core test` |
| Full suite command | `pnpm -r test`                            |

### Phase Requirements -> Test Map

| Req ID  | Behavior                                | Test Type   | Automated Command                               | File Exists?                 |
| ------- | --------------------------------------- | ----------- | ----------------------------------------------- | ---------------------------- |
| TYPE-01 | 타입 import 경로 통일, 컴파일 성공      | typecheck   | `pnpm -r build` (tsc)                           | N/A (컴파일 검증)            |
| TYPE-02 | ai-gateway 주요 함수 단위 테스트        | unit        | `pnpm --filter @ai-signalcraft/ai-gateway test` | Wave 0 생성                  |
| TYPE-03 | advn-schema.test.ts 분할, 각 300줄 이하 | unit        | `pnpm --filter @ai-signalcraft/core test`       | Wave 0 생성 (기존 파일 분할) |
| TYPE-04 | 모든 패키지 기존 테스트 통과            | integration | `pnpm -r test`                                  | 기존 테스트                  |

### Sampling Rate

- **Per task commit:** `pnpm --filter @ai-signalcraft/{패키지} test`
- **Per wave merge:** `pnpm -r test`
- **Phase gate:** Full suite + `pnpm -r build` 모두 green

### Wave 0 Gaps

- [ ] `packages/ai-gateway/tests/gateway.test.ts` -- TYPE-02 테스트 파일
- [ ] `packages/core/tests/advn-approval-rating.test.ts` -- TYPE-03 분할 파일 1
- [ ] `packages/core/tests/advn-frame-war.test.ts` -- TYPE-03 분할 파일 2
- [ ] `packages/core/tests/advn-crisis-scenario.test.ts` -- TYPE-03 분할 파일 3
- [ ] `packages/core/tests/advn-win-simulation.test.ts` -- TYPE-03 분할 파일 4
- [ ] `packages/core/tests/advn-exports.test.ts` -- TYPE-03 분할 파일 5

## Pre-existing Test Failures (TYPE-04 참고)

현재 테스트 실행 결과 (Phase 9 작업 전):

- **collectors:** 8 files, 49 tests -- ALL PASSED
- **core:** 11 files, 102 tests -- 2 files failed (6 tests)
  - `analysis-runner.test.ts` (4 failed) -- DB mock 부재로 getModuleModelConfig 호출 실패
  - `report.test.ts` (2 failed) -- 동일 원인
- **ai-gateway:** 테스트 파일 0개
- **web:** 별도 확인 필요

**TYPE-04 판정 기준:** Phase 9 변경 후 사전 실패 6개를 제외한 나머지 96개 테스트가 모두 통과하면 요건 충족. 사전 실패는 DB 연결 문제로 Phase 9 범위 밖.

## Open Questions

1. **getModel export 여부**
   - What we know: 현재 module-private (export 키워드 없음)
   - What's unclear: D-07에 getModel 테스트가 명시되어 있으나 export 필요
   - Recommendation: `export function getModel(...)` 으로 변경. gateway.ts의 public API 확장이지만 ai-gateway 패키지의 index.ts에는 추가하지 않아 패키지 외부 API는 변경 없음

2. **ProviderType alias 유지 여부**
   - What we know: core/analysis/types.ts에 `export type ProviderType = AIProvider` 호환성 alias 존재
   - What's unclear: 외부에서 ProviderType을 사용하는 곳이 있는지
   - Recommendation: AIProvider re-export와 함께 ProviderType alias도 유지

## Project Constraints (from CLAUDE.md)

- **Package manager:** pnpm 사용
- **Language:** TypeScript (코드는 영어, 주석은 한국어)
- **Test framework:** Vitest
- **Commit convention:** 한국어 제목, conventional commit 타입
- **Security:** API 키 하드코딩 금지, .env 커밋 금지
- **GSD Workflow:** Edit/Write 전 GSD 명령어로 진입
- **Superpowers:** executor가 brainstorming, TDD, code-review 등 스킬 호출 필수

## Sources

### Primary (HIGH confidence)

- 프로젝트 소스 코드 직접 탐색 -- gateway.ts, types.ts, barrel exports, 테스트 파일
- Vitest 3.2.4 -- 프로젝트에 설치된 버전 확인
- pnpm 워크스페이스 테스트 실행 결과 -- collectors 49 passed, core 96/102 passed

### Secondary (MEDIUM confidence)

- CONTEXT.md 결정 사항 -- 사용자와 논의 후 확정된 9개 결정

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- 기존 프로젝트 스택 그대로 사용, 추가 라이브러리 없음
- Architecture: HIGH -- 기존 types/ 패턴이 확립되어 있어 동일 패턴 적용
- Pitfalls: HIGH -- 코드베이스 직접 탐색으로 import 체인과 사전 실패 확인

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (안정적 리팩토링, 외부 의존성 변경 없음)
