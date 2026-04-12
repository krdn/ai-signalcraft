# /add-domain — AI SignalCraft 분석 도메인 추가/갱신 스킬

새로운 분석 도메인을 AI SignalCraft에 추가하거나, 기존 도메인의 변경 사항(모듈 추가/제거 등)을 전체 시스템에 동기화합니다.
세계 표준 학술 이론을 기반으로 DomainConfig, Stage 4 모듈, Zod 스키마, UI 컴포넌트를 자동 생성합니다.

## 트리거

`/add-domain` 명령어 또는 다음 키워드:

- "새 분석 유형 추가"
- "새 도메인 추가"
- "분석 도메인 구현"
- "분석유형 갱신"
- "도메인 업데이트"

## 인자

```
/add-domain \
  --id <domain-id>           # 영문 소문자, 하이픈 허용 (예: gaming, nonprofit)
  --name <표시명>            # 한글 이름 (예: "게임/e스포츠")
  --category <카테고리>      # 핵심 활용 | 산업 특화 | 확장 영역
  --tier <1|2|3>             # 구현 복잡도 (신규 추가 시)
  --theories <이론목록>      # 쉼표 구분 (선택, 미입력시 Claude가 자동 추천)
  --reuse-modules <모듈목록> # 재사용할 기존 Stage 4 모듈 (Tier 2용)
  --new-modules <모듈목록>   # 신규 생성할 Stage 4 모듈명 목록

# 기존 도메인 갱신:
/add-domain --update <domain-id>
# 예: /add-domain --update corporate
```

## Tier 가이드

| Tier | 설명                                                         | 공수 | 적합 상황                      |
| ---- | ------------------------------------------------------------ | ---- | ------------------------------ |
| 1    | 기존 Stage 4 모듈 전체 재사용 + 시스템 프롬프트 오버라이드만 | 빠름 | 기존 도메인과 유사한 분석 구조 |
| 2    | 기존 모듈 2개 재사용 + 신규 모듈 2개                         | 보통 | 일부 독자적 분석 필요          |
| 3    | 4개+ 완전 신규 Stage 4 모듈                                  | 느림 | 완전히 다른 분석 관점 필요     |

---

## 실행 절차

### Step 0: 모드 결정

**신규 추가** (`--id` 있음): Step 1부터 전체 실행
**기존 갱신** (`--update` 있음): Step 4 (코어 불필요, 프론트엔드만) 또는 변경된 부분만 실행

---

### Step 1: 이론 리서치 (Claude 자동 수행)

도메인 특성에 맞는 세계 표준 학술 이론을 분석합니다:

```
분석 항목:
1. 이 도메인의 의사결정 지원 목적은 무엇인가?
2. 어떤 집단 분류 체계가 적합한가?
3. 어떤 Stage 1~2 공통 모듈 프롬프트를 오버라이드해야 하나?
4. Stage 4에 어떤 독자적 분석이 필요한가?
5. 세계 표준 이론은 무엇인가? (TheoreticalReference 배열 — 최소 3개)
```

---

### Step 2: 코어 파이프라인 수정/생성 파일 목록

**항상 수정 (모든 Tier)**:

1. `packages/core/src/analysis/domain/types.ts` — AnalysisDomain union에 추가
2. `packages/core/src/analysis/domain/registry.ts` — REGISTRY에 import+추가
3. `apps/web/src/server/trpc/routers/analysis.ts` — domain enum에 추가
4. `packages/core/src/analysis/schemas/segmentation.schema.ts` — SEGMENT_TYPES_BY_DOMAIN에 추가

**항상 생성 (모든 Tier)**: 5. `packages/core/src/analysis/domain/domains/{id}.ts` — DomainConfig 전체

**Tier 2~3 추가 생성**: 6. `packages/core/src/analysis/schemas/{module-name}.schema.ts` — 신규 모듈 스키마 7. `packages/core/src/analysis/modules/{id}/{module-name}.ts` — 신규 모듈 구현 8. `packages/core/src/analysis/modules/prompt-utils.ts` — distillFor{ModuleName} 함수 (필요시)

**Tier 2~3 추가 수정**: 9. `packages/core/src/analysis/types.ts` — MODULE_MODEL_MAP에 신규 모듈 추가 10. `packages/core/src/analysis/modules/index.ts` — 신규 모듈 export 추가 11. `packages/core/src/analysis/runner.ts` — MODULE_MAP에 신규 모듈 추가 12. `packages/core/src/analysis/schemas/index.ts` — 신규 스키마 export 추가

---

### Step 3: DomainConfig 구조 (필수 포함 항목)

```typescript
export const {DOMAIN_ID_UPPER}_DOMAIN: DomainConfig = {
  id: '{domain-id}',
  displayName: '{표시명}',

  // 이론적 기반 (TheoreticalReference[] — 최소 3개)
  theoreticalBasis: [
    {
      theory: '이론명 (영문)',
      scholar: '저자, 이름 이니셜.',
      year: 연도,
      keyConceptKo: '한국어 이론명',
      application: '이 분석 시스템에서 어떤 모듈/분석에 적용되는지',
      applicableModules: ['모듈명1', '모듈명2'],
    },
    // ... 최소 3개
  ],

  platformKnowledge: `한국 온라인 플랫폼 특성 테이블 (도메인 맥락 반영)`,
  impactScoreAnchor: `점수 기준 (도메인 사례 예시 포함)`,
  frameStrengthAnchor: `프레임 강도 기준`,
  probabilityAnchor: `확률 기준`,

  segmentationLabels: {
    types: ['집단타입1', '집단타입2', '집단타입3'],  // SEGMENT_TYPES_BY_DOMAIN과 일치해야 함
    criteria: {
      '집단타입1': '판별 기준 설명',
    },
  },

  modulePrompts: {
    'macro-view': { systemPrompt: `도메인 특화 역할 + 이론 + 분석 중점` },
    segmentation: { systemPrompt: `집단 분류 기준 + 이론` },
    'sentiment-framing': { systemPrompt: `프레임 분석 기준` },
    'message-impact': { systemPrompt: `메시지 효과 분석 기준` },
    'risk-map': { systemPrompt: `리스크 분류 기준` },
    opportunity: { systemPrompt: `기회 분석 기준` },
    strategy: { systemPrompt: `전략 수립 기준` },
    'final-summary': { systemPrompt: `요약 형식` },
    'crisis-scenario': { systemPrompt: `위기 시나리오 맥락` },
    // Stage 4 신규 모듈도 포함
  },

  stage4: {
    parallel: ['모듈명1', '모듈명2'],
    sequential: ['모듈명3', '모듈명4'],
  },

  reportSystemPrompt: `리포트 생성자 역할 및 목적`,
  reportSectionTemplate: `
## 한 줄 요약
## [도메인별 섹션]
...
## 전략 제안
## 최종 요약`,
};
```

---

### Step 4: 신규 Stage 4 모듈 구조 (Tier 2~3)

```typescript
// 스키마 파일: packages/core/src/analysis/schemas/{name}.schema.ts
export const {Name}Schema = z.object({
  // 모든 배열 필드에 .default([]) 설정
  // 모든 점수 필드에 .min(0).max(100).catch(50)
  // 모든 enum 필드에 .catch('기본값')
  summary: z.string().catch(''),
});
export type {Name}Result = z.infer<typeof {Name}Schema>;

// 모듈 파일: packages/core/src/analysis/modules/{domain}/{name}.ts
export const {name}Module: AnalysisModule<{Name}Result> = {
  name: '{module-id}',
  displayName: '{표시명}',
  provider: config.provider,
  model: config.model,
  schema: {Name}Schema,

  buildSystemPrompt(domain?: AnalysisDomain): string { ... },
  buildPromptWithContext(data, priorResults, domain?) { ... },  // 선행 결과 활용
  buildPrompt(data: AnalysisInput): string { ... },  // 폴백
};
```

---

### Step 5: 프론트엔드 전체 갱신 (신규 추가 및 갱신 모두 적용)

새 도메인 추가 또는 기존 도메인 모듈 변경 시 아래 6개 파일을 **모두** 갱신합니다.

#### 5-A. 프리셋 시드 데이터

파일: `packages/core/src/db/seed-presets.ts`

```typescript
{
  slug: '{domain_id_underscore}',  // 예: corporate_reputation
  category: '{카테고리}',           // 핵심 활용 | 산업 특화 | 확장 영역
  domain: '{domain-id}',
  title: '{표시명}',
  description: '{설명}',
  icon: '{LucideIconName}',
  highlight: '{핵심 효과 한 줄}',
  sortOrder: {순서},
  sources: { naver: true, youtube: true, dcinside: true, fmkorea: true, clien: true },
  customSourceIds: [],
  limits: { naverArticles: 500, youtubeVideos: 50, communityPosts: 50, commentsPerItem: 300 },
  optimization: 'standard',
  skippedModules: [],    // 정치 전용 모듈만 포함된 경우 제외 — 단, 반드시 kebab-case로 작성
  enableItemAnalysis: false,
}
```

#### 5-B. 랜딩페이지 사용 사례 카드

파일: `apps/web/src/components/landing/data/use-cases.ts`

```typescript
// USE_CASE_CATEGORIES[해당 카테고리].cases 배열에 추가
{
  icon: {LucideIcon},
  title: '{표시명}',
  description: '{분석 효과 설명}',
  highlight: '{핵심 수치 효과}',
  domainId: '{domain-id}',
  theoreticalHighlight: '{이론1} · {이론2} 기반',
}
```

#### 5-C. 도움말 모달 데이터

파일: `apps/web/src/components/landing/data/domain-help.ts`

DOMAIN_HELP_DATA 객체에 추가:

```typescript
'{domain-id}': {
  id: '{domain-id}',
  displayName: '{표시명}',
  description: '{도메인 개요}',
  tagline: '{짧은 핵심 문구}',
  analysisModules: [
    ...COMMON_MODULES,  // Stage 1~3은 공통
    {
      stage: 'Stage 4',
      label: '{도메인} 고급 분석 (ADVN)',
      modules: [
        // stage4 모듈 각각 명시
        { name: '{모듈 표시명}', description: '{이론 기반 설명}' },
      ],
    },
  ],
  theoreticalBasis: [
    // DomainConfig.theoreticalBasis와 동일한 이론 (최소 3개)
    { theory: '', scholar: '', year: 0, keyConceptKo: '', application: '' },
  ],
  usageExamples: [
    { scenario: '{활용 시나리오}', context: '{배경 상황}', outcome: '{결과 효과}' },
    { scenario: '...', context: '...', outcome: '...' },
  ],
},
```

#### 5-D. 도메인 배지 색상

파일: `apps/web/src/components/analysis/domain-badge.tsx`

DOMAIN_META 객체에 추가:

```typescript
'{domain-id}': { label: '{한글 짧은명}', color: 'bg-{색상}-500/15 text-{색상}-600 border-{색상}-500/20' },
```

색상 선택 가이드:
| 도메인 유형 | 권장 색상 |
|------------|---------|
| 정치/정책 | blue, indigo |
| 기업/금융 | sky, yellow |
| 팬덤/문화 | violet, pink |
| 의료/과학 | teal, green |
| 스포츠 | orange |
| 법률/공공 | slate, gray |

#### 5-E. AI 설정 > 모듈별 모델 UI

파일: `apps/web/src/components/settings/model-settings.tsx`

**5-E-1. ModuleMeta 타입 확장** (domain union에 새 도메인 추가):

```typescript
domain?: 'political' | 'fandom' | 'corporate' | '{new-domain}';
```

**5-E-2. MODULE_META에 신규 Stage 4 모듈 메타 추가**:

```typescript
'{module-id}': {
  name: '{한글 표시명}',
  description: '{기능 설명}',
  analyzes: [
    '분석 항목 1',
    '분석 항목 2',
    '분석 항목 3',
    '분석 항목 4',
  ],
  recommended: {
    provider: '{provider}',
    model: '{model}',
    reason: '{이 모델을 권장하는 이유}',
  },
  costTip: '{비용 절감 팁}',
  domain: '{domain-id}',
},
```

**5-E-3. DOMAIN_MODULES에 도메인 추가**:

```typescript
const DOMAIN_MODULES: Record<string, string[]> = {
  political: [...],
  fandom: [...],
  corporate: [...],
  '{new-domain}': ['stage4-module-1', 'stage4-module-2', ...],
};
```

**5-E-4. PRESET_DOMAIN_MAP에 프리셋→도메인 매핑 추가**:

```typescript
'{preset_slug}': { domain: '{domain-id}', title: '{표시명}', category: '{카테고리}' },
```

**5-E-5. getModulesForPreset 함수 확인** — 신규 도메인이 DOMAIN_MODULES에 없으면 빈 배열 반환하므로 fallback 로직 확인

#### 5-F. 고급 분석 도움말 (Stage 4 모듈별 카드 도움말)

파일: `apps/web/src/components/advanced/advanced-help.tsx`

ADVANCED_HELP 객체에 신규 Stage 4 모듈별 도움말 추가:

```typescript
// camelCase로 키 작성 (예: stakeholderMap, mediaFramingDominance)
{camelCaseModuleName}: {
  title: '{모듈 표시명}',
  description: '{이론 기반 포함 1~2문장 설명}',
  details: [
    '주요 출력 필드 설명 1',
    '주요 출력 필드 설명 2',
    // 3~6개
  ],
  howToRead: [
    '이 결과를 어떻게 해석하는가 1',
    '이 결과를 어떻게 해석하는가 2',
    // 3~4개
  ],
  tips: [
    '실무 활용 팁 1',
    '실무 활용 팁 2',
    // 2~3개
  ],
  limitations: [
    '한계점 1 — 데이터 기반 추정의 한계',
    '한계점 2',
    // 2~3개
  ],
  technicalDetails: [
    '입력: 기사 N건 + 댓글 N건',
    '선행 의존: {모듈1}({필드}), {모듈2}({필드})',
    '알고리즘: {분석 방법}',
    '출력: {주요 필드}',
  ],
  source: '{module-id} 모듈 ({provider} {model})',
},
```

**주의**: advanced-help.tsx에 추가한 키는 해당 UI 카드 컴포넌트(`apps/web/src/components/advanced/{module-name}-card.tsx`)에서 `ADVANCED_HELP.{camelCaseKey}`로 참조됩니다. 카드 컴포넌트도 함께 생성/수정해야 합니다.

---

### Step 6: 신규 Stage 4 모듈 UI 카드 (Tier 2~3)

파일: `apps/web/src/components/advanced/{module-name}-card.tsx`

기존 카드(`win-simulation-card.tsx`, `stakeholder-map-card.tsx` 등)를 참고하여 새 스키마에 맞는 UI 컴포넌트 작성:

```typescript
'use client';

import { ADVANCED_HELP, AdvancedCardHelp } from './advanced-help';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface {ModuleName}CardProps {
  data: Record<string, unknown> | null;
}

export function {ModuleName}Card({ data }: {ModuleName}CardProps) {
  if (!data) return null;
  const result = data as {ModuleName}Result;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {표시명}
          <AdvancedCardHelp {...ADVANCED_HELP.{camelCaseKey}} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 스키마 필드에 맞는 UI */}
      </CardContent>
    </Card>
  );
}
```

---

### Step 7: 검증

```bash
# 1. 타입 체크
pnpm --filter @ai-signalcraft/core typecheck

# 2. 린트
pnpm lint

# 3. 새 도메인으로 분석 실행 테스트
# domain: '{new-domain-id}' 파라미터로 트리거 확인

# 4. AI 설정 UI에서 새 도메인 프리셋 선택 시 올바른 모듈 표시 확인

# 5. 랜딩페이지에서 새 카드 및 도움말 모달 확인
```

---

### Step 8: Atomic 커밋 순서

```
커밋 1: feat: {domain-id} 도메인 코어 파이프라인 추가 (domain config, 타입, 레지스트리)
커밋 2: feat: {domain-id} 신규 분석 모듈 N개 추가 (스키마 + 모듈 구현)
커밋 3: feat: {domain-id} Stage 4 모듈 등록 및 runner 연결
커밋 4: feat: {domain-id} 프론트엔드 — 랜딩/도움말/배지/프리셋 갱신
커밋 5: feat: {domain-id} AI 설정 UI — 모듈별 모델 및 도메인 매핑 추가
커밋 6: feat: {domain-id} 고급 분석 UI 카드 N개 추가
```

---

## 갱신 모드 (`--update`)

기존 도메인에 모듈이 추가/제거된 경우 실행합니다.

```bash
/add-domain --update corporate
```

**갱신 시 체크리스트**:

- [ ] `domain/domains/{id}.ts` — stage4, modulePrompts 최신 상태 확인
- [ ] `runner.ts` — MODULE_MAP에 신규 모듈 등록 여부
- [ ] `model-settings.tsx` — DOMAIN_MODULES, MODULE_META 동기화
- [ ] `domain-help.ts` — Stage 4 모듈 목록 및 이론 동기화
- [ ] `advanced-help.tsx` — 신규 모듈 도움말 추가 여부
- [ ] `seed-presets.ts` — skippedModules 정합성 (kebab-case, 실제 stage4에 없는 모듈만)
- [ ] `data/modules.ts` — Stage 4 그룹에 신규 모듈 항목 추가 (랜딩페이지 모듈 목록)
- [ ] `landing-content.tsx` — AI 분석 모듈 개수 숫자 업데이트 (`grep -c "nameEn:" modules.ts`로 확인)
- [ ] `whitepaper/report-data.ts` — REPORT_META subtitle 및 REPORT_SECTIONS 모듈 개수 업데이트
- [ ] `data/use-cases.ts` — `USE_CASE_DETAILS['{도메인명}']`의 keyModules, workflow, scenarios, tagline 갱신
- [ ] `advanced/advanced-view.tsx` — ADVN 모듈 상수, detectDomain(), 도메인 렌더링 분기 추가
- [ ] `advanced/{module}-card.tsx` — 신규 모듈 카드 컴포넌트 생성 (미구현 카드 확인 필수)

---

## 세그먼트 타입 추가

새 도메인 추가 시 반드시 `segmentation.schema.ts`의 `SEGMENT_TYPES_BY_DOMAIN`에도 추가:

```typescript
// packages/core/src/analysis/schemas/segmentation.schema.ts
export const SEGMENT_TYPES_BY_DOMAIN = {
  // 기존 도메인들...
  '{new-domain-id}': ['집단타입1', '집단타입2', '집단타입3'],
};
```

---

## 주요 참고 이론 목록

| 도메인 유형   | 적합한 이론                                                                                |
| ------------- | ------------------------------------------------------------------------------------------ |
| 위기/평판     | SCCT (Coombs, 2007), Image Repair (Benoit, 1997)                                           |
| 기업/브랜드   | RepTrak (Fombrun, 2004), Stakeholder Theory (Freeman, 1984), SLO (Thomson, 2000)           |
| 정치/정책     | Framing Theory (Entman, 1993), Agenda-Setting (McCombs & Shaw, 1972), ACF (Sabatier, 1993) |
| 소비자/유통   | Brand Equity (Keller, 1993), Consumer Complaint (Singh, 1988)                              |
| 금융/투자     | Behavioral Finance (Kahneman, 1979), Information Cascade (Bikhchandani, 1992)              |
| 의료/공중보건 | HBM (Rosenstock, 1966), Risk Perception (Slovic, 1987)                                     |
| 스포츠/팬덤   | BIRGing/CORFing (Cialdini, 1976), Fan Engagement Ladder (Hills, 2002)                      |
| 교육/공공기관 | Institutional Reputation (Fombrun, 1996), Public Trust (Levi, 2000)                        |
| CSR/ESG       | Organizational Hypocrisy (Brunsson, 1989), Signaling Theory (Spence, 1973)                 |
| 미디어/PR     | Media Framing (Entman, 1993), Agenda-Setting (McCombs & Shaw, 1972)                        |

---

## 관련 파일 경로 빠른 참조

| 역할                   | 파일 경로                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------- |
| 도메인 타입            | `packages/core/src/analysis/domain/types.ts`                                        |
| 도메인 레지스트리      | `packages/core/src/analysis/domain/registry.ts`                                     |
| 도메인 설정            | `packages/core/src/analysis/domain/domains/{id}.ts`                                 |
| 분석 라우터            | `apps/web/src/server/trpc/routers/analysis.ts`                                      |
| 세그먼트 타입          | `packages/core/src/analysis/schemas/segmentation.schema.ts`                         |
| MODULE_MODEL_MAP       | `packages/core/src/analysis/types.ts`                                               |
| MODULE_MAP             | `packages/core/src/analysis/runner.ts`                                              |
| 모듈 index             | `packages/core/src/analysis/modules/index.ts`                                       |
| 스키마 index           | `packages/core/src/analysis/schemas/index.ts`                                       |
| distill 함수           | `packages/core/src/analysis/modules/prompt-utils.ts`                                |
| 프리셋 시드            | `packages/core/src/db/seed-presets.ts`                                              |
| 랜딩 use-cases         | `apps/web/src/components/landing/data/use-cases.ts`                                 |
| 도움말 데이터          | `apps/web/src/components/landing/data/domain-help.ts`                               |
| 도메인 배지            | `apps/web/src/components/analysis/domain-badge.tsx`                                 |
| AI 설정 UI             | `apps/web/src/components/settings/model-settings.tsx`                               |
| 고급 도움말            | `apps/web/src/components/advanced/advanced-help.tsx`                                |
| ADVN 카드              | `apps/web/src/components/advanced/{module}-card.tsx`                                |
| **고급분석 뷰 (핵심)** | `apps/web/src/components/advanced/advanced-view.tsx`                                |
| 랜딩 모듈 목록         | `apps/web/src/components/landing/data/modules.ts`                                   |
| 랜딩 모듈 개수         | `apps/web/src/components/landing/landing-content.tsx` (h2 + 통계 배지)              |
| 화이트페이퍼 개수      | `apps/web/src/components/whitepaper/report-data.ts` (REPORT_META + REPORT_SECTIONS) |
