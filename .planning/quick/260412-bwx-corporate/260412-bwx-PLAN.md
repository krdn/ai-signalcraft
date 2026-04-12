---
quick_task: 260412-bwx-corporate
type: execute
wave: 1
depends_on: []
autonomous: true
files_modified:
  # Bug fixes
  - packages/core/src/pipeline/pipeline-checks.ts
  - packages/core/src/analysis/pipeline-orchestrator.ts
  - packages/core/src/queue/analysis-worker.ts
  # New schemas
  - packages/core/src/analysis/schemas/media-framing-dominance.schema.ts
  - packages/core/src/analysis/schemas/csr-communication-gap.schema.ts
  - packages/core/src/analysis/schemas/reputation-recovery-simulation.schema.ts
  # New modules
  - packages/core/src/analysis/modules/corporate/media-framing-dominance.ts
  - packages/core/src/analysis/modules/corporate/csr-communication-gap.ts
  - packages/core/src/analysis/modules/corporate/reputation-recovery-simulation.ts
  # Registration & wiring
  - packages/core/src/analysis/modules/prompt-utils.ts
  - packages/core/src/analysis/types.ts
  - packages/core/src/analysis/modules/index.ts
  - packages/core/src/analysis/runner.ts
  - packages/core/src/analysis/domain/domains/corporate.ts
  - packages/core/src/db/seed-presets.ts
  # UI cards
  - apps/web/src/components/advanced/media-framing-dominance-card.tsx
  - apps/web/src/components/advanced/csr-communication-gap-card.tsx
  - apps/web/src/components/advanced/reputation-recovery-simulation-card.tsx

must_haves:
  truths:
    - 'Corporate Stage 4 병렬 실행 시 6개 모듈(stakeholder-map, esg-sentiment, reputation-index, crisis-type-classifier, media-framing-dominance, csr-communication-gap)이 실행됨'
    - 'skippedModules camelCase/kebab-case 불일치로 스킵이 누락되지 않음'
    - "markSkipped()가 status: 'skipped'로 저장됨 (failed 아님)"
    - 'checkFailAndAbort()와 realFailed가 skipped 모듈을 실패로 오인하지 않음'
    - 'reputation-recovery-simulation이 선행 6개 결과를 종합하여 실행됨'
  artifacts:
    - path: 'packages/core/src/analysis/schemas/media-framing-dominance.schema.ts'
    - path: 'packages/core/src/analysis/schemas/csr-communication-gap.schema.ts'
    - path: 'packages/core/src/analysis/schemas/reputation-recovery-simulation.schema.ts'
    - path: 'packages/core/src/analysis/modules/corporate/media-framing-dominance.ts'
    - path: 'packages/core/src/analysis/modules/corporate/csr-communication-gap.ts'
    - path: 'packages/core/src/analysis/modules/corporate/reputation-recovery-simulation.ts'
    - path: 'apps/web/src/components/advanced/media-framing-dominance-card.tsx'
    - path: 'apps/web/src/components/advanced/csr-communication-gap-card.tsx'
    - path: 'apps/web/src/components/advanced/reputation-recovery-simulation-card.tsx'
  key_links:
    - from: 'pipeline-checks.ts getSkippedModules()'
      to: 'isSkipped() in pipeline-orchestrator.ts'
      via: 'camelToKebab 변환'
    - from: 'corporate.ts stage4.parallel'
      to: 'runner.ts getStage4Modules()'
      via: '6개 모듈 등록'
    - from: 'reputation-recovery-simulation module'
      to: 'distillForReputationRecovery() in prompt-utils.ts'
      via: 'buildPromptWithContext'
---

<objective>
Corporate 도메인 분석 파이프라인 리팩토링:
1. 버그 4개 수정 (camelCase 매칭, skipped status 시맨틱, 실패 판단 조건)
2. 신규 분석 모듈 3개 추가 (media-framing-dominance, csr-communication-gap, reputation-recovery-simulation)
3. Corporate Stage 4 재구성 (parallel 2개 → 6개, sequential win-simulation → reputation-recovery-simulation)
4. UI 카드 3개 신규 생성

Purpose: Corporate Stage 4 분석 깊이 확대 + 파이프라인 skipped 처리 정합성 확보
Output: 수정된 파이프라인 코어 + 3개 신규 모듈 + 3개 UI 카드
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.claude/rules/ai-pipeline.md
@packages/core/src/analysis/modules/corporate/stakeholder-map.ts
@packages/core/src/analysis/modules/corporate/esg-sentiment.ts
@apps/web/src/components/advanced/win-simulation-card.tsx
</context>

<tasks>

<!-- ═══════════════════════════════════════════════
     TASK 1: 버그 수정 — pipeline-checks, orchestrator, worker
     ═══════════════════════════════════════════════ -->
<task type="auto">
  <name>Task 1: 파이프라인 버그 4개 수정</name>
  <files>
    packages/core/src/pipeline/pipeline-checks.ts,
    packages/core/src/analysis/pipeline-orchestrator.ts,
    packages/core/src/queue/analysis-worker.ts
  </files>
  <action>
**pipeline-checks.ts — camelToKebab 변환 추가**

`getSkippedModules()`가 DB에서 camelCase(`frameWar`)를 반환하지만 `isSkipped('frame-war')` kebab-case와 매칭되지 않는 문제를 수정한다.

파일 상단에 헬퍼 함수 추가:

```typescript
function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, (c) => `-${c.toLowerCase()}`);
}
```

`getSkippedModules()` 반환 직전에 변환 적용:

```typescript
return ((job?.skippedModules as string[]) ?? []).map(camelToKebab);
```

---

**pipeline-orchestrator.ts — markSkipped() status 수정 + checkFailAndAbort() 조건 수정**

`markSkipped()` (line ~205) 수정:

- `status: 'failed'` → `status: 'skipped'`
- `errorMessage: '사용자에 의해 스킵됨'` 필드 제거

```typescript
async function markSkipped(moduleName: string) {
  await persistAnalysisResult({
    jobId,
    module: moduleName,
    status: 'skipped',
  });
  allResults[moduleName] = {
    module: moduleName,
    status: 'skipped',
  };
}
```

`checkFailAndAbort()` (line ~169) 수정 — `r.errorMessage !== '사용자에 의해 스킵됨'` 조건 제거:

```typescript
const failed = stageModules.filter((r) => r.status === 'failed');
```

---

**analysis-worker.ts — realFailed 필터 수정**

line ~66 수정:

```typescript
const realFailed = result.failedModules.filter((m) => {
  const r = result.moduleResults?.[m];
  return r?.status !== 'skipped';
});
```

  </action>
  <verify>
    <automated>cd /home/gon/projects/ai/ai-signalcraft && pnpm lint --filter=@ai-signalcraft/core 2>&1 | tail -5</automated>
  </verify>
  <done>
    - pipeline-checks.ts에 camelToKebab 변환이 적용됨
    - markSkipped()가 status:'skipped'로 저장하고 errorMessage 없음
    - checkFailAndAbort()가 r.status === 'failed'만 체크
    - analysis-worker.ts realFailed가 r?.status !== 'skipped'로 필터링
    - lint 통과
  </done>
</task>

<!-- ═══════════════════════════════════════════════
     TASK 2: 스키마 3개 생성
     ═══════════════════════════════════════════════ -->
<task type="auto">
  <name>Task 2: Corporate 신규 스키마 3개 생성</name>
  <files>
    packages/core/src/analysis/schemas/media-framing-dominance.schema.ts,
    packages/core/src/analysis/schemas/csr-communication-gap.schema.ts,
    packages/core/src/analysis/schemas/reputation-recovery-simulation.schema.ts
  </files>
  <action>
기존 스키마 패턴(`packages/core/src/analysis/schemas/crisis-type-classifier.schema.ts`) 참조. 모든 필드에 `.catch(defaultValue)` 방어 처리 적용.

---

**media-framing-dominance.schema.ts**
Media Framing Theory (Entman, 1993) + Agenda-Setting Theory (McCombs & Shaw, 1972) 기반.

```typescript
import { z } from 'zod';

export const MediaFramingDominanceSchema = z.object({
  dominantFrame: z.string().catch('').describe('지배적 미디어 프레임 명칭'),
  dominantFrameScore: z.number().min(0).max(100).catch(0).describe('지배적 프레임 점수 (0~100)'),
  frames: z
    .array(
      z.object({
        frameName: z.string().catch(''),
        frameType: z
          .enum(['diagnostic', 'prognostic', 'motivational'])
          .catch('diagnostic')
          .describe(
            'Entman 프레임 유형: diagnostic=문제정의, prognostic=해결방향, motivational=행동촉구',
          ),
        dominanceScore: z.number().min(0).max(100).catch(0),
        mediaOutlets: z.array(z.string()).default([]).describe('이 프레임을 주로 사용하는 미디어'),
        sampleHeadlines: z.array(z.string()).default([]),
        agendaSettingImpact: z
          .enum(['high', 'medium', 'low'])
          .catch('medium')
          .describe('의제설정 영향력 (McCombs & Shaw)'),
      }),
    )
    .default([]),
  frameContestLevel: z
    .enum(['dominant', 'contested', 'fragmented'])
    .catch('contested')
    .describe('프레임 경합 수준: dominant=단일지배, contested=경합, fragmented=분산'),
  frameShiftRisk: z
    .number()
    .min(0)
    .max(100)
    .catch(0)
    .describe('프레임 전환 위험도 — 현재 프레임이 부정으로 역전될 확률'),
  corporateNarrativeGap: z
    .string()
    .catch('')
    .describe('기업 공식 서사와 미디어 프레임 간 간극 요약'),
  recommendation: z.string().catch('').describe('프레임 관리 권고사항'),
  summary: z.string().catch(''),
});

export type MediaFramingDominanceResult = z.infer<typeof MediaFramingDominanceSchema>;
```

---

**csr-communication-gap.schema.ts**
CSR Organizational Hypocrisy (Brunsson, 1989) 기반.

```typescript
import { z } from 'zod';

export const CsrCommunicationGapSchema = z.object({
  overallHypocrisyScore: z
    .number()
    .min(0)
    .max(100)
    .catch(0)
    .describe('CSR 위선 점수 — 공약과 실천 간 격차 (0=완전 일치, 100=극도의 위선)'),
  esgDimensionGaps: z
    .array(
      z.object({
        dimension: z.enum(['E', 'S', 'G']).catch('S').describe('ESG 차원'),
        dimensionName: z.string().catch(''),
        claimedPosition: z.string().catch('').describe('기업이 주장하는 입장'),
        perceivedReality: z.string().catch('').describe('여론이 인식하는 현실'),
        gapScore: z.number().min(0).max(100).catch(0).describe('차원별 격차 점수'),
        publicReaction: z
          .enum(['backlash', 'skeptical', 'neutral', 'supportive'])
          .catch('skeptical'),
      }),
    )
    .default([]),
  greenwashingRisk: z
    .enum(['high', 'medium', 'low', 'none'])
    .catch('medium')
    .describe('그린워싱 리스크 수준'),
  credibilityIndex: z
    .number()
    .min(0)
    .max(100)
    .catch(50)
    .describe('CSR 신뢰도 지수 (100=완전 신뢰)'),
  keyHypocrisyTriggers: z
    .array(
      z.object({
        trigger: z.string().catch(''),
        publicSentiment: z.string().catch(''),
        reputationalImpact: z.enum(['severe', 'moderate', 'minor']).catch('moderate'),
      }),
    )
    .default([]),
  communicationRecommendation: z.string().catch('').describe('CSR 커뮤니케이션 개선 권고'),
  summary: z.string().catch(''),
});

export type CsrCommunicationGapResult = z.infer<typeof CsrCommunicationGapSchema>;
```

---

**reputation-recovery-simulation.schema.ts**
RepTrak Recovery (Fombrun, 2004) + SCCT (Coombs, 2007) + SLO (Thomson, 2000) 기반.

```typescript
import { z } from 'zod';

export const ReputationRecoverySimulationSchema = z.object({
  recoveryProbability: z.number().min(0).max(100).catch(0).describe('평판 회복 달성 확률 (%)'),
  targetReputationScore: z.number().min(0).max(100).catch(60).describe('목표 RepTrak 점수'),
  baselineScore: z.number().min(0).max(100).catch(0).describe('현재 reputation-index 기반선 점수'),
  recoveryTimelineMonths: z.number().min(1).catch(12).describe('목표 달성 예상 기간 (개월)'),
  recoveryPhases: z
    .array(
      z.object({
        phase: z.number().min(1).max(4).catch(1),
        phaseName: z.string().catch(''),
        durationMonths: z.number().min(1).catch(3),
        keyActions: z.array(z.string()).default([]),
        expectedScoreGain: z.number().catch(0),
        criticalStakeholders: z.array(z.string()).default([]),
        successIndicator: z.string().catch(''),
      }),
    )
    .default([]),
  crisisTypeInfluence: z
    .object({
      crisisType: z.enum(['victim', 'accidental', 'preventable']).catch('accidental'),
      recoveryMultiplier: z
        .number()
        .catch(1.0)
        .describe('위기 유형에 따른 회복 난이도 배수 (1.0=보통, >1.0=어려움)'),
      recommendedStrategy: z.string().catch(''),
    })
    .catch({ crisisType: 'accidental', recoveryMultiplier: 1.0, recommendedStrategy: '' }),
  sloRecoveryConditions: z
    .array(
      z.object({
        condition: z.string().catch(''),
        currentStatus: z.enum(['met', 'partial', 'unmet']).catch('unmet'),
        actionRequired: z.string().catch(''),
      }),
    )
    .default([])
    .describe('사회적 운영 허가(SLO) 회복 조건'),
  keyObstacles: z
    .array(
      z.object({
        obstacle: z.string().catch(''),
        source: z.string().catch(''),
        mitigationStrategy: z.string().catch(''),
      }),
    )
    .default([])
    .describe('risk-map 기반 회복 장애 조건'),
  simulationSummary: z.string().catch(''),
});

export type ReputationRecoverySimulationResult = z.infer<typeof ReputationRecoverySimulationSchema>;
```

  </action>
  <verify>
    <automated>cd /home/gon/projects/ai/ai-signalcraft && npx tsc --noEmit -p packages/core/tsconfig.json 2>&1 | grep "schema" | head -10</automated>
  </verify>
  <done>
    - 스키마 파일 3개 생성 완료
    - 모든 필드에 .catch() 방어 처리 적용
    - export type 포함
    - TypeScript 타입 오류 없음
  </done>
</task>

<!-- ═══════════════════════════════════════════════
     TASK 3: 분석 모듈 3개 생성 + prompt-utils 추가
     ═══════════════════════════════════════════════ -->
<task type="auto">
  <name>Task 3: Corporate 신규 모듈 3개 생성 + distillForReputationRecovery</name>
  <files>
    packages/core/src/analysis/modules/corporate/media-framing-dominance.ts,
    packages/core/src/analysis/modules/corporate/csr-communication-gap.ts,
    packages/core/src/analysis/modules/corporate/reputation-recovery-simulation.ts,
    packages/core/src/analysis/modules/prompt-utils.ts
  </files>
  <action>
기존 모듈 패턴(`stakeholder-map.ts`) 참조. `buildPromptWithContext`를 우선 사용하고, `buildPrompt`는 컨텍스트 없을 때의 fallback으로 제공.

---

**media-framing-dominance.ts**

- provider: `gemini-cli`, model: `gemini-2.5-flash`
- `buildPromptWithContext`: `priorResults['sentiment-framing']`에서 프레임 목록, `priorResults['macro-view']`에서 뉴스 흐름 추출

```typescript
import {
  MediaFramingDominanceSchema,
  type MediaFramingDominanceResult,
} from '../../schemas/media-framing-dominance.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import { ANALYSIS_CONSTRAINTS, buildModuleSystemPrompt, formatDateRange } from '../prompt-utils';

const config = MODULE_MODEL_MAP['media-framing-dominance'];

export const mediaFramingDominanceModule: AnalysisModule<MediaFramingDominanceResult> = {
  name: 'media-framing-dominance',
  displayName: '미디어 프레임 지배력 분석',
  provider: config.provider,
  model: config.model,
  schema: MediaFramingDominanceSchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    const override = buildModuleSystemPrompt('media-framing-dominance', domain);
    if (override) return `${override}\n${ANALYSIS_CONSTRAINTS}`;
    return `당신은 미디어 프레임 분석 전문가입니다.
**Media Framing Theory (Entman, 1993)**와 **Agenda-Setting Theory (McCombs & Shaw, 1972)**를 적용하여 기업 이슈의 미디어 프레임 지배력을 분석합니다.

## 분석 중점
- Entman 3가지 프레임 유형: diagnostic(문제 정의), prognostic(해결 방향), motivational(행동 촉구)
- 어떤 미디어가 어떤 프레임을 지배하는지 매핑
- 기업의 공식 서사(official narrative)와 미디어 프레임 간 간극 측정
- 의제설정 영향력: 어느 미디어가 여론 의제를 주도하는가
${ANALYSIS_CONSTRAINTS}`;
  },

  buildPromptWithContext(
    data: AnalysisInput,
    priorResults: Record<string, unknown>,
    _domain?: AnalysisDomain,
  ): string {
    const sentimentFraming = priorResults['sentiment-framing'] as any;
    const macroView = priorResults['macro-view'] as any;

    const existingFrames = sentimentFraming?.frames
      ? sentimentFraming.frames
          .map((f: any) => `- ${f.frameName} (강도: ${f.strength ?? 'N/A'})`)
          .join('\n')
      : '선행 프레임 분석 없음';

    const newsFlow = macroView?.overallTrend ?? macroView?.summary ?? '뉴스 흐름 데이터 없음';

    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 선행 감정·프레임 분석 결과
${existingFrames}

## 전체 뉴스 흐름 (macro-view)
${newsFlow}

## 뉴스 기사 (최근 20건)
${data.articles
  .slice(0, 20)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 주요 댓글 (20건)
${data.comments
  .slice(0, 20)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 100)}`)
  .join('\n')}

---
Media Framing Theory(Entman)와 Agenda-Setting Theory(McCombs & Shaw)를 적용하여:
1. 지배적 프레임과 경합 프레임을 식별하고 점수화하세요
2. 각 프레임의 미디어 주도 매체와 의제설정 영향력을 평가하세요
3. 기업 공식 서사와 미디어 프레임 간 간극을 분석하세요
4. 프레임 전환 위험도와 관리 권고사항을 제시하세요`;
  },

  buildPrompt(data: AnalysisInput): string {
    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 뉴스 기사 (최근 20건)
${data.articles
  .slice(0, 20)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 댓글 (20건)
${data.comments
  .slice(0, 20)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 100)}`)
  .join('\n')}

---
Media Framing Theory(Entman)와 Agenda-Setting Theory(McCombs & Shaw)를 적용하여 미디어 프레임 지배력을 분석하세요.`;
  },
};
```

---

**csr-communication-gap.ts**

- provider: `anthropic`, model: `claude-sonnet-4-6`
- `buildPromptWithContext`: `priorResults['esg-sentiment']`에서 E/S/G 여론, `priorResults['sentiment-framing']`에서 프레임 활용

```typescript
import {
  CsrCommunicationGapSchema,
  type CsrCommunicationGapResult,
} from '../../schemas/csr-communication-gap.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import { ANALYSIS_CONSTRAINTS, buildModuleSystemPrompt, formatDateRange } from '../prompt-utils';

const config = MODULE_MODEL_MAP['csr-communication-gap'];

export const csrCommunicationGapModule: AnalysisModule<CsrCommunicationGapResult> = {
  name: 'csr-communication-gap',
  displayName: 'CSR 커뮤니케이션 갭 분석',
  provider: config.provider,
  model: config.model,
  schema: CsrCommunicationGapSchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    const override = buildModuleSystemPrompt('csr-communication-gap', domain);
    if (override) return `${override}\n${ANALYSIS_CONSTRAINTS}`;
    return `당신은 기업 CSR 커뮤니케이션 분석 전문가입니다.
**CSR Organizational Hypocrisy (Brunsson, 1989)**를 적용하여 기업의 CSR 공약과 실제 여론 인식 간 격차를 분석합니다.

## 분석 중점
- 기업이 공개적으로 주장하는 ESG 입장 vs 여론이 실제로 인식하는 현실
- E(환경), S(사회), G(거버넌스) 3개 차원별 위선 점수 산출
- 그린워싱 리스크: 환경 공약과 실제 행동의 불일치
- CSR 신뢰도 지수: 이해관계자가 기업 CSR 주장을 얼마나 신뢰하는가
${ANALYSIS_CONSTRAINTS}`;
  },

  buildPromptWithContext(
    data: AnalysisInput,
    priorResults: Record<string, unknown>,
    _domain?: AnalysisDomain,
  ): string {
    const esgSentiment = priorResults['esg-sentiment'] as any;
    const sentimentFraming = priorResults['sentiment-framing'] as any;

    const esgDimensions = esgSentiment
      ? `E(환경) 여론: ${esgSentiment.environmentalScore ?? 'N/A'}, S(사회) 여론: ${esgSentiment.socialScore ?? 'N/A'}, G(거버넌스) 여론: ${esgSentiment.governanceScore ?? 'N/A'}`
      : 'ESG 여론 데이터 없음';

    const esgRisk = esgSentiment?.regulatoryRisk ?? '데이터 없음';

    const frames = sentimentFraming?.frames
      ? sentimentFraming.frames
          .slice(0, 3)
          .map((f: any) => `- ${f.frameName}`)
          .join('\n')
      : '';

    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## ESG 여론 선행 분석 (esg-sentiment)
${esgDimensions}
규제 리스크: ${esgRisk}

## 주요 프레임 (sentiment-framing)
${frames || '없음'}

## 뉴스 기사 (최근 15건)
${data.articles
  .slice(0, 15)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 주요 댓글 (25건)
${data.comments
  .slice(0, 25)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 120)}`)
  .join('\n')}

---
CSR Organizational Hypocrisy(Brunsson, 1989)를 적용하여:
1. E/S/G 각 차원별 기업 공약과 여론 인식 간 격차를 점수화하세요
2. 그린워싱 리스크와 CSR 신뢰도 지수를 산출하세요
3. 위선을 촉발하는 핵심 트리거 이벤트를 식별하세요
4. CSR 커뮤니케이션 개선 권고사항을 제시하세요`;
  },

  buildPrompt(data: AnalysisInput): string {
    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 뉴스 기사 (최근 15건)
${data.articles
  .slice(0, 15)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 댓글 (25건)
${data.comments
  .slice(0, 25)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 120)}`)
  .join('\n')}

---
CSR Organizational Hypocrisy(Brunsson)를 적용하여 기업 CSR 공약과 여론 인식 간 격차를 분석하세요.`;
  },
};
```

---

**reputation-recovery-simulation.ts**

- provider: `anthropic`, model: `claude-sonnet-4-6`
- `buildPromptWithContext`: `distillForReputationRecovery()` 함수 호출로 선행 6개 결과 종합

```typescript
import {
  ReputationRecoverySimulationSchema,
  type ReputationRecoverySimulationResult,
} from '../../schemas/reputation-recovery-simulation.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import {
  ANALYSIS_CONSTRAINTS,
  buildModuleSystemPrompt,
  formatDateRange,
  distillForReputationRecovery,
} from '../prompt-utils';

const config = MODULE_MODEL_MAP['reputation-recovery-simulation'];

export const reputationRecoverySimulationModule: AnalysisModule<ReputationRecoverySimulationResult> =
  {
    name: 'reputation-recovery-simulation',
    displayName: '평판 회복 시뮬레이션',
    provider: config.provider,
    model: config.model,
    schema: ReputationRecoverySimulationSchema,

    buildSystemPrompt(domain?: AnalysisDomain): string {
      const override = buildModuleSystemPrompt('reputation-recovery-simulation', domain);
      if (override) return `${override}\n${ANALYSIS_CONSTRAINTS}`;
      return `당신은 기업 평판 회복 전략 시뮬레이터입니다.
**RepTrak Recovery (Fombrun, 2004)**, **SCCT (Coombs, 2007)**, **SLO (Thomson, 2000)**을 통합하여 기업 평판 회복 경로를 시뮬레이션합니다.

## 시뮬레이션 원칙
- recoveryProbability: 선행 분석 데이터 기반 평판 회복 달성 확률 (%)
- 위기 유형(SCCT)에 따라 회복 전략과 난이도가 달라짐 (victim < accidental < preventable)
- SLO 회복 조건: 사회로부터 운영 허가를 다시 얻기 위한 조건
- 회복 장애: risk-map의 topRisks가 회복을 방해하는 메커니즘
${ANALYSIS_CONSTRAINTS}`;
    },

    buildPromptWithContext(
      data: AnalysisInput,
      priorResults: Record<string, unknown>,
      _domain?: AnalysisDomain,
    ): string {
      const context = distillForReputationRecovery(priorResults);

      return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 선행 분석 종합 (distilled context)
${context}

## 뉴스 기사 (최근 10건)
${data.articles
  .slice(0, 10)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

---
RepTrak Recovery(Fombrun), SCCT(Coombs), SLO(Thomson)을 통합하여:
1. 현재 기반선 점수와 목표 점수를 설정하고 회복 달성 확률(%)을 산출하세요
2. 위기 유형이 회복 전략에 미치는 영향을 분석하세요 (SCCT 책임 귀속)
3. SLO 회복을 위한 필수 조건 및 현재 충족 여부를 평가하세요
4. 회복 단계별 로드맵 (1~4단계)과 핵심 이해관계자를 제시하세요
5. 회복을 방해하는 핵심 장애물과 대응 전략을 명시하세요`;
    },

    buildPrompt(data: AnalysisInput): string {
      return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 뉴스 기사 (최근 10건)
${data.articles
  .slice(0, 10)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 댓글 (20건)
${data.comments
  .slice(0, 20)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 100)}`)
  .join('\n')}

---
RepTrak Recovery, SCCT, SLO를 통합하여 평판 회복 시뮬레이션을 수행하세요.`;
    },
  };
```

---

**prompt-utils.ts — distillForReputationRecovery 함수 추가**

파일 맨 끝에 추가 (기존 코드 수정 없음):

```typescript
/**
 * reputation-recovery-simulation 모듈용 컨텍스트 추출
 * 선행 6개 모듈 결과에서 핵심 데이터를 종합
 */
export function distillForReputationRecovery(priorResults: Record<string, unknown>): string {
  const reputationIndex = priorResults['reputation-index'] as any;
  const crisisTypeClassifier = priorResults['crisis-type-classifier'] as any;
  const stakeholderMap = priorResults['stakeholder-map'] as any;
  const esgSentiment = priorResults['esg-sentiment'] as any;
  const crisisScenario = priorResults['crisis-scenario'] as any;
  const riskMap = priorResults['risk-map'] as any;

  const lines: string[] = [];

  // 기반선 점수
  if (reputationIndex?.overallScore !== undefined) {
    lines.push(`### 현재 평판 기반선 (reputation-index)`);
    lines.push(`- 종합 점수: ${reputationIndex.overallScore}/100`);
    if (reputationIndex.summary) lines.push(`- 요약: ${reputationIndex.summary}`);
  }

  // 위기 유형 (SCCT 회복 전략 가중치)
  if (crisisTypeClassifier?.crisisType) {
    lines.push(`\n### 위기 유형 분류 (crisis-type-classifier)`);
    lines.push(
      `- 위기 유형: ${crisisTypeClassifier.crisisType} (${crisisTypeClassifier.crisisTypeName ?? ''})`,
    );
    lines.push(`- 책임 귀속 수준: ${crisisTypeClassifier.responsibilityLevel}`);
    if (crisisTypeClassifier.recommendedStrategies?.length) {
      const top = crisisTypeClassifier.recommendedStrategies[0];
      lines.push(`- 1순위 권고 전략: ${top.strategyName ?? top.strategy}`);
    }
  }

  // 핵심 이해관계자
  if (stakeholderMap?.criticalStakeholder ?? stakeholderMap?.stakeholders) {
    lines.push(`\n### 핵심 이해관계자 (stakeholder-map)`);
    const critical = stakeholderMap.criticalStakeholder ?? stakeholderMap.stakeholders?.[0];
    if (critical)
      lines.push(
        `- 최우선 이해관계자: ${typeof critical === 'string' ? critical : (critical.name ?? JSON.stringify(critical))}`,
      );
  }

  // ESG 회복 가능성
  if (esgSentiment?.regulatoryRisk !== undefined || esgSentiment?.overallScore !== undefined) {
    lines.push(`\n### ESG 회복 가능성 (esg-sentiment)`);
    if (esgSentiment.overallScore !== undefined)
      lines.push(`- ESG 종합 점수: ${esgSentiment.overallScore}`);
    if (esgSentiment.regulatoryRisk !== undefined)
      lines.push(`- 규제 리스크: ${esgSentiment.regulatoryRisk}`);
  }

  // 확산 리스크
  if (crisisScenario?.scenarios?.length) {
    lines.push(`\n### 위기 확산 리스크 (crisis-scenario)`);
    const spread =
      crisisScenario.scenarios.find((s: any) => s.type === 'spread') ?? crisisScenario.scenarios[0];
    if (spread)
      lines.push(`- 확산 시나리오: ${spread.title ?? spread.type} — ${spread.probability ?? ''}%`);
  }

  // 회복 장애 조건
  if (riskMap?.topRisks?.length) {
    lines.push(`\n### 회복 장애 조건 (risk-map)`);
    riskMap.topRisks.slice(0, 3).forEach((r: any) => {
      lines.push(`- ${r.title}: ${r.description?.slice(0, 80) ?? ''}`);
    });
  }

  return lines.length > 0
    ? lines.join('\n')
    : '선행 분석 데이터 없음 — 기사/댓글 데이터 기반으로 분석';
}
```

  </action>
  <verify>
    <automated>cd /home/gon/projects/ai/ai-signalcraft && npx tsc --noEmit -p packages/core/tsconfig.json 2>&1 | grep -E "error|Error" | head -15</automated>
  </verify>
  <done>
    - 모듈 파일 3개 생성 완료 (corporate/ 하위)
    - distillForReputationRecovery() 함수 prompt-utils.ts에 추가
    - 모든 모듈이 buildPrompt + buildPromptWithContext 모두 구현
    - TypeScript 타입 오류 없음
  </done>
</task>

<!-- ═══════════════════════════════════════════════
     TASK 4: 등록·연결 (types, index, runner, corporate, seed-presets)
     ═══════════════════════════════════════════════ -->
<task type="auto">
  <name>Task 4: 모듈 등록 및 Corporate Stage 4 재구성</name>
  <files>
    packages/core/src/analysis/types.ts,
    packages/core/src/analysis/modules/index.ts,
    packages/core/src/analysis/runner.ts,
    packages/core/src/analysis/domain/domains/corporate.ts,
    packages/core/src/db/seed-presets.ts
  </files>
  <action>
**types.ts — MODULE_MODEL_MAP에 3개 추가**

`// Stage 4: 기업 평판 도메인 신규 모듈` 블록 아래 추가:

```typescript
  'media-framing-dominance': { provider: 'gemini-cli', model: 'gemini-2.5-flash' },
  'csr-communication-gap': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  'reputation-recovery-simulation': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
```

---

**modules/index.ts — 3개 모듈 export 추가**

기존 corporate 모듈 export 블록에 추가:

```typescript
export { mediaFramingDominanceModule } from './corporate/media-framing-dominance';
export { csrCommunicationGapModule } from './corporate/csr-communication-gap';
export { reputationRecoverySimulationModule } from './corporate/reputation-recovery-simulation';
```

---

**runner.ts — MODULE_MAP 등록**

기존 corporate 모듈이 등록된 곳 근처에 3개 추가:

```typescript
[mediaFramingDominanceModule.name]: mediaFramingDominanceModule,
[csrCommunicationGapModule.name]: csrCommunicationGapModule,
[reputationRecoverySimulationModule.name]: reputationRecoverySimulationModule,
```

import 추가:

```typescript
import {
  mediaFramingDominanceModule,
  csrCommunicationGapModule,
  reputationRecoverySimulationModule,
} from './modules';
```

---

**corporate.ts — stage4 재구성 + modulePrompts 추가**

`stage4` 섹션 교체 (line ~249):

```typescript
stage4: {
  parallel: [
    'stakeholder-map',
    'esg-sentiment',
    'reputation-index',
    'crisis-type-classifier',
    'media-framing-dominance',
    'csr-communication-gap',
  ],
  sequential: ['crisis-scenario', 'reputation-recovery-simulation'],
},
```

`modulePrompts` 객체에 3개 추가 (기존 'win-simulation' 항목 뒤에):

```typescript
'media-framing-dominance': {
  systemPrompt: `당신은 미디어 프레임 분석 전문가입니다.
**Media Framing Theory (Entman, 1993)**와 **Agenda-Setting Theory (McCombs & Shaw, 1972)**를 적용하여 기업 이슈의 미디어 프레임 지배력을 분석합니다.

## 분석 중점
- 어떤 미디어가 어떤 프레임(diagnostic/prognostic/motivational)을 지배하는지 매핑
- 기업 공식 서사와 미디어 프레임 간 간극 측정
- 프레임 전환 위험도: 현재 프레임이 부정으로 역전될 가능성`,
},
'csr-communication-gap': {
  systemPrompt: `당신은 CSR 커뮤니케이션 분석 전문가입니다.
**CSR Organizational Hypocrisy (Brunsson, 1989)**를 적용하여 기업 CSR 공약과 실제 여론 인식 간 격차를 분석합니다.

## 분석 중점
- E/S/G 각 차원별 기업 주장 vs 여론 인식 격차 점수화
- 그린워싱 리스크 수준 판단
- CSR 위선을 촉발하는 이벤트 식별`,
},
'reputation-recovery-simulation': {
  systemPrompt: `당신은 기업 평판 회복 전략 시뮬레이터입니다.
**RepTrak Recovery (Fombrun, 2004)**, **SCCT (Coombs, 2007)**, **SLO (Thomson, 2000)**을 통합하여 기업 평판 회복 경로를 시뮬레이션합니다.

## 시뮬레이션 원칙
- recoveryProbability: 선행 전체 분석 기반 평판 회복 달성 확률 (%)
- 위기 유형(SCCT)에 따른 회복 전략 차별화 (victim < accidental < preventable)
- SLO 회복: 사회적 운영 허가 재획득 조건 평가
- 회복 장애: 이전 Stage 분석에서 도출된 리스크가 회복을 방해하는 메커니즘

## win-simulation과의 차별화
- win-simulation은 정치 도메인 프레임 — 이 모듈은 기업 평판 회복에 특화
- SCCT 위기 유형과 SLO 프레임워크 명시적 활용`,
},
```

---

**seed-presets.ts — skippedModules 정리**

corporate 프리셋의 `skippedModules`를 빈 배열로 설정 (기존에 있던 항목 제거):

```typescript
skippedModules: [],
```

파일에서 corporate 관련 `skippedModules` 항목을 찾아 `[]`로 교체.
</action>
<verify>
<automated>cd /home/gon/projects/ai/ai-signalcraft && npx tsc --noEmit -p packages/core/tsconfig.json 2>&1 | grep -c "error" && echo "errors found" || echo "clean"</automated>
</verify>
<done> - MODULE_MODEL_MAP에 3개 항목 추가됨 - modules/index.ts에서 3개 모듈 export됨 - runner.ts MODULE_MAP에 3개 등록됨 - corporate.ts stage4.parallel이 6개, sequential이 ['crisis-scenario', 'reputation-recovery-simulation'] - modulePrompts에 3개 시스템 프롬프트 추가됨 - seed-presets.ts corporate skippedModules가 [] - TypeScript 타입 오류 없음
</done>
</task>

<!-- ═══════════════════════════════════════════════
     TASK 5: UI 카드 3개 생성
     ═══════════════════════════════════════════════ -->
<task type="auto">
  <name>Task 5: UI 카드 3개 생성</name>
  <files>
    apps/web/src/components/advanced/media-framing-dominance-card.tsx,
    apps/web/src/components/advanced/csr-communication-gap-card.tsx,
    apps/web/src/components/advanced/reputation-recovery-simulation-card.tsx
  </files>
  <action>
`apps/web/src/components/advanced/win-simulation-card.tsx` 구조 참조. 각 카드는:
- `'use client'` 선언
- props: `data: Record<string, unknown> | null`
- data가 null이면 "분석 데이터 없음" placeholder 반환
- shadcn/ui Card, Badge, 적절한 lucide-react 아이콘 사용
- Tailwind 4 클래스 사용

---

**media-framing-dominance-card.tsx**

- 표시할 핵심 데이터: `dominantFrame`, `dominantFrameScore` (진행 바), `frames` 목록 (최대 3개, frameName + dominanceScore + agendaSettingImpact), `frameContestLevel` (Badge), `frameShiftRisk`, `corporateNarrativeGap`, `recommendation`
- 아이콘: `Newspaper` (미디어), `TrendingUp`/`TrendingDown`
- frameContestLevel 색상: dominant=green, contested=amber, fragmented=red

---

**csr-communication-gap-card.tsx**

- 표시할 핵심 데이터: `overallHypocrisyScore` (0~100, 높을수록 위험), `esgDimensionGaps` 3개 (E/S/G 각각 gapScore bar), `greenwashingRisk` (Badge), `credibilityIndex`, `communicationRecommendation`
- 아이콘: `Leaf` (ESG), `AlertTriangle`
- greenwashingRisk 색상: high=red, medium=amber, low=green, none=blue

---

**reputation-recovery-simulation-card.tsx**
`win-simulation-card.tsx`와 가장 유사한 구조. RadialBarChart(Recharts) 활용하여 `recoveryProbability` 시각화.

- 표시할 핵심 데이터: `recoveryProbability` (RadialBar), `baselineScore`→`targetReputationScore` (현재→목표), `recoveryTimelineMonths`, `recoveryPhases` 목록 (최대 3단계), `crisisTypeInfluence.crisisType` (Badge), `sloRecoveryConditions` (met/partial/unmet 아이콘), `simulationSummary`
- crisisType 색상: victim=blue, accidental=amber, preventable=red

win-simulation-card.tsx에서 `WinSimulationData` 인터페이스와 `chartConfig` 패턴을 그대로 차용하되 필드명만 교체.
</action>
<verify>
<automated>cd /home/gon/projects/ai/ai-signalcraft && npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -E "advanced.*card|card.*advanced" | head -10</automated>
</verify>
<done> - UI 카드 3개 파일 생성 완료 - 각 카드가 data: null 처리 포함 - shadcn/ui + Tailwind 4 사용 - reputation-recovery-simulation-card.tsx에 RadialBarChart 포함 - TypeScript 타입 오류 없음
</done>
</task>

<!-- ═══════════════════════════════════════════════
     TASK 6: 빌드 검증
     ═══════════════════════════════════════════════ -->
<task type="auto">
  <name>Task 6: 전체 빌드 및 lint 검증</name>
  <files></files>
  <action>
전체 TypeScript 컴파일 오류 확인 및 lint 통과 검증:
1. `pnpm --filter=@ai-signalcraft/core tsc --noEmit` — core 패키지 타입 체크
2. `pnpm lint` — 전체 ESLint 검사
3. 오류 발생 시 근본 원인 수정 후 재검증

lint 오류 예상 패턴 및 대응:

- `eslint-disable-line @typescript-eslint/no-explicit-any` — priorResults 캐스팅에 필요 시 추가
- import 순서 오류 — eslint-plugin-import가 강제하는 순서에 맞게 정렬
  </action>
  <verify>
  <automated>cd /home/gon/projects/ai/ai-signalcraft && pnpm lint 2>&1 | tail -10</automated>
  </verify>
  <done> - `pnpm lint` 오류 0개 (warning은 허용) - core 패키지 TypeScript 타입 오류 0개 - web 패키지 TypeScript 타입 오류 0개
  </done>
  </task>

</tasks>

<verification>
구현 완료 후 확인:

1. **버그 수정 확인**
   - `getSkippedModules()` 반환값이 kebab-case인지 확인
   - `markSkipped()` 호출 후 DB에 status='skipped'로 저장되는지 확인
   - `checkFailAndAbort()` 조건이 `r.status === 'failed'`만 확인

2. **모듈 등록 확인**

   ```bash
   grep -n "media-framing-dominance\|csr-communication-gap\|reputation-recovery-simulation" \
     packages/core/src/analysis/types.ts \
     packages/core/src/analysis/modules/index.ts \
     packages/core/src/analysis/runner.ts
   ```

3. **Corporate Stage 4 확인**

   ```bash
   grep -A 10 "stage4" packages/core/src/analysis/domain/domains/corporate.ts
   ```

   → parallel 6개, sequential ['crisis-scenario', 'reputation-recovery-simulation'] 확인

4. **빌드 통과**
   ```bash
   cd /home/gon/projects/ai/ai-signalcraft && pnpm lint
   ```
   </verification>

<success_criteria>

- 버그 4개 수정 완료 (camelToKebab, status:'skipped', checkFailAndAbort, realFailed)
- 스키마 3개 생성 (media-framing-dominance, csr-communication-gap, reputation-recovery-simulation)
- 모듈 3개 생성 및 등록 (types + index + runner + corporate.ts)
- Corporate Stage 4: parallel 6개 + sequential ['crisis-scenario', 'reputation-recovery-simulation']
- distillForReputationRecovery() 함수 prompt-utils.ts에 추가
- seed-presets.ts corporate skippedModules = []
- UI 카드 3개 생성
- pnpm lint 통과
  </success_criteria>

<output>
완료 후 `.planning/quick/260412-bwx-corporate/260412-bwx-SUMMARY.md` 생성:
- 구현된 변경사항 요약
- 수정된 버그 목록
- 신규 생성 파일 목록
- 주요 결정사항
- Superpowers 호출 기록 섹션 포함
</output>
