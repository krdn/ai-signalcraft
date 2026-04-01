# AI 분석 파이프라인 규칙

## 분석 모듈 구조

모듈 위치: `packages/core/src/analysis/modules/`
스키마 위치: `packages/core/src/analysis/schemas/`

### 모듈 추가 시 체크리스트

1. `modules/<name>.ts` — AnalysisModule 인터페이스 구현
2. `schemas/<name>.schema.ts` — Zod 스키마 정의
3. `modules/index.ts` — export 추가
4. `runner.ts` — 해당 Stage 배열에 모듈 등록
5. `pipeline-orchestrator.ts` — Stage 실행 순서 확인

### Stage 구성

- **Stage 1** (병렬): macroView, segmentation, sentimentFraming, messageImpact
- **Stage 2** (순차, Stage 1 의존): riskMap → opportunity → strategy → finalSummary
- **Stage 4** (고급, 선택): approvalRating, frameWar (병렬) → crisisScenario, winSimulation (순차)

### 모듈 패턴

```typescript
export const exampleModule: AnalysisModule<ExampleResult> = {
  name: 'example',
  displayName: '예시 분석',
  provider: MODULE_MODEL_MAP['example'].provider,
  model: MODULE_MODEL_MAP['example'].model,
  schema: ExampleSchema,
  buildSystemPrompt(): string { ... },
  buildPrompt(data: AnalysisInput): string { ... },
  // Stage 2+에서 이전 결과 참조 시:
  buildPromptWithContext?(data: AnalysisInput, priorResults: Record<string, unknown>): string { ... },
};
```

## 수집기 구조

수집기 위치: `packages/collectors/src/adapters/`

### 수집기 추가 시 체크리스트

1. `Collector` 인터페이스 구현 (AsyncGenerator 패턴)
2. 커뮤니티 사이트는 `CommunityBaseCollector` 상속
3. `registry.ts`에 등록
4. `packages/core/src/queue/flows.ts`에 Flow 추가

### 스크래퍼 오류 대응

1. **먼저** CSS 셀렉터/URL 패턴 변경 확인
2. 사이트 구조 변경 시 셀렉터 업데이트
3. robots.txt 및 이용약관 준수 확인
