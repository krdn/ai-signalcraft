# 여론 조작 탐지 Phase 1 — Foundation 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 여론 조작 탐지의 결정론 레이어(DB 스키마 4개 테이블 + 7개 신호 계산기 + Aggregator + Tier 1 단위 테스트)를 외부 노출 없이 구현한다.

**Architecture:** `packages/core/src/analysis/manipulation/`에 새 모듈 생성. 7개 신호는 SQL/TS·pgvector로 결정론적 계산, LLM 미사용. Aggregator는 가중 평균으로 0~100 점수 산출. Phase 2(파이프라인 통합)·Phase 3(UI)는 별도 plan.

**Tech Stack:** TypeScript 5, Drizzle ORM, PostgreSQL 16 + pgvector, Vitest 3, postgres.js, BullMQ 5 (호출 측), 384-dim 임베딩 (기존)

**참조 spec:** `docs/superpowers/specs/2026-04-27-manipulation-detection-design.md`

---

## File Structure

### 신규 파일

| 파일                                                                       | 책임                                                                    |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `packages/core/src/db/schema/manipulation.ts`                              | 4개 테이블 정의 (runs/signals/evidence/domain_configs)                  |
| `packages/core/src/db/seed-manipulation-configs.ts`                        | manipulation_domain_configs 시드 (political 1행)                        |
| `packages/core/src/analysis/manipulation/types.ts`                         | SignalResult, EvidenceCard, VisualizationSpec, SignalType, DomainConfig |
| `packages/core/src/analysis/manipulation/index.ts`                         | public API export                                                       |
| `packages/core/src/analysis/manipulation/runner.ts`                        | ManipulationRunner: 7개 신호 병렬 실행 + 저장                           |
| `packages/core/src/analysis/manipulation/aggregator.ts`                    | weightedAvg + confidenceFactor                                          |
| `packages/core/src/analysis/manipulation/signals/burst.ts`                 | S1 — z-score                                                            |
| `packages/core/src/analysis/manipulation/signals/similarity.ts`            | S3 — pgvector + n-gram (S7 부가 출력 포함)                              |
| `packages/core/src/analysis/manipulation/signals/vote.ts`                  | S4 — IQR + 잔차                                                         |
| `packages/core/src/analysis/manipulation/signals/media-sync.ts`            | S5 — 30분 윈도우 + cosine                                               |
| `packages/core/src/analysis/manipulation/signals/trend-shape.ts`           | S6 — 차분 + 변화점                                                      |
| `packages/core/src/analysis/manipulation/signals/temporal.ts`              | S8 — KL divergence                                                      |
| `packages/core/src/analysis/manipulation/signals/cross-platform.ts`        | S7 — S3 클러스터 후처리                                                 |
| `packages/core/src/analysis/manipulation/utils/ngram.ts`                   | 5-gram Jaccard 유틸                                                     |
| `packages/core/src/analysis/manipulation/utils/stats.ts`                   | median, MAD, KL, IQR 유틸                                               |
| `packages/core/src/analysis/manipulation/__tests__/burst.test.ts`          | S1 단위 테스트                                                          |
| `packages/core/src/analysis/manipulation/__tests__/similarity.test.ts`     | S3 단위 테스트                                                          |
| `packages/core/src/analysis/manipulation/__tests__/vote.test.ts`           | S4 단위 테스트                                                          |
| `packages/core/src/analysis/manipulation/__tests__/media-sync.test.ts`     | S5 단위 테스트                                                          |
| `packages/core/src/analysis/manipulation/__tests__/trend-shape.test.ts`    | S6 단위 테스트                                                          |
| `packages/core/src/analysis/manipulation/__tests__/temporal.test.ts`       | S8 단위 테스트                                                          |
| `packages/core/src/analysis/manipulation/__tests__/cross-platform.test.ts` | S7 단위 테스트                                                          |
| `packages/core/src/analysis/manipulation/__tests__/aggregator.test.ts`     | Aggregator 단위 테스트                                                  |
| `packages/core/src/analysis/manipulation/__tests__/runner.test.ts`         | Runner 통합 (in-memory PG fixture)                                      |
| `packages/core/src/analysis/manipulation/__tests__/utils/ngram.test.ts`    | n-gram 유틸                                                             |
| `packages/core/src/analysis/manipulation/__tests__/utils/stats.test.ts`    | 통계 유틸                                                               |
| `packages/core/scripts/manipulation-dryrun.ts`                             | 내부 CLI (jobId 입력 → run 실행, 외부 노출 없음)                        |

### 수정 파일

| 파일                                   | 변경                                                         |
| -------------------------------------- | ------------------------------------------------------------ |
| `packages/core/src/db/schema/index.ts` | `export * from './manipulation';` 추가                       |
| `packages/core/package.json`           | scripts에 `db:seed-manipulation`, `manipulation:dryrun` 추가 |

---

## Phase 1 범위 (절대 포함하지 않는 것)

- pipeline-orchestrator 통합 (Phase 2)
- LLM Narrative 모듈 (Phase 2)
- collection_jobs.options 토글 (Phase 2)
- UI 컴포넌트·tRPC 라우터 (Phase 3)
- Tier 2 회귀 골든 (Phase 2)

---

## Task 0: DB 스키마 정의 + push

**Files:**

- Create: `packages/core/src/db/schema/manipulation.ts`
- Modify: `packages/core/src/db/schema/index.ts`

- [ ] **Step 0.1: 스키마 파일 작성**

`packages/core/src/db/schema/manipulation.ts`:

```typescript
import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  real,
  uuid,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { collectionJobs } from './collections';

export const SIGNAL_TYPES = [
  'burst',
  'similarity',
  'vote',
  'media-sync',
  'trend-shape',
  'cross-platform',
  'temporal',
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

export const SEVERITY = ['low', 'medium', 'high'] as const;
export type Severity = (typeof SEVERITY)[number];

export const manipulationRuns = pgTable(
  'manipulation_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: integer('job_id')
      .references(() => collectionJobs.id, { onDelete: 'cascade' })
      .notNull(),
    subscriptionId: integer('subscription_id'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    status: text('status', { enum: ['running', 'completed', 'failed'] })
      .notNull()
      .default('running'),
    manipulationScore: real('manipulation_score'),
    confidenceFactor: real('confidence_factor'),
    weightsVersion: text('weights_version').notNull().default('v1-political'),
    signalScores: jsonb('signal_scores').$type<Partial<Record<SignalType, number>>>(),
    narrativeMd: text('narrative_md'),
    errorDetails: jsonb('error_details').$type<{ message?: string; stack?: string }>(),
  },
  (table) => [
    index('manipulation_runs_subscription_idx').on(table.subscriptionId, table.startedAt),
    index('manipulation_runs_job_idx').on(table.jobId),
  ],
);

export const manipulationSignals = pgTable(
  'manipulation_signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .references(() => manipulationRuns.id, { onDelete: 'cascade' })
      .notNull(),
    signal: text('signal', { enum: SIGNAL_TYPES }).notNull(),
    score: real('score').notNull(),
    confidence: real('confidence').notNull(),
    metrics: jsonb('metrics').$type<Record<string, number>>().notNull(),
    computeMs: integer('compute_ms').notNull(),
  },
  (table) => [uniqueIndex('manipulation_signals_run_signal_idx').on(table.runId, table.signal)],
);

export const manipulationEvidence = pgTable(
  'manipulation_evidence',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .references(() => manipulationRuns.id, { onDelete: 'cascade' })
      .notNull(),
    signal: text('signal', { enum: SIGNAL_TYPES }).notNull(),
    severity: text('severity', { enum: SEVERITY }).notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    visualization: jsonb('visualization').notNull(),
    rawRefs: jsonb('raw_refs')
      .$type<{ itemId: string; source: string; time: string; excerpt: string }[]>()
      .notNull(),
    rank: integer('rank').notNull(),
  },
  (table) => [
    index('manipulation_evidence_run_rank_idx').on(table.runId, table.severity, table.rank),
    index('manipulation_evidence_raw_refs_gin').using('gin', table.rawRefs),
  ],
);

export const manipulationDomainConfigs = pgTable('manipulation_domain_configs', {
  domain: text('domain').primaryKey(),
  weights: jsonb('weights').$type<Record<SignalType, number>>().notNull(),
  thresholds: jsonb('thresholds')
    .$type<Record<SignalType, { medium: number; high: number }>>()
    .notNull(),
  baselineDays: integer('baseline_days').notNull().default(30),
  narrativeContext: text('narrative_context').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ManipulationRun = typeof manipulationRuns.$inferSelect;
export type NewManipulationRun = typeof manipulationRuns.$inferInsert;
export type ManipulationSignal = typeof manipulationSignals.$inferSelect;
export type NewManipulationSignal = typeof manipulationSignals.$inferInsert;
export type ManipulationEvidence = typeof manipulationEvidence.$inferSelect;
export type NewManipulationEvidence = typeof manipulationEvidence.$inferInsert;
export type ManipulationDomainConfig = typeof manipulationDomainConfigs.$inferSelect;
```

- [ ] **Step 0.2: index.ts에 export 추가**

`packages/core/src/db/schema/index.ts`의 마지막에 한 줄 추가:

```typescript
export * from './manipulation';
```

- [ ] **Step 0.3: 빌드 확인**

Run: `pnpm --filter @ai-signalcraft/core build`
Expected: 컴파일 성공, 새 타입 export 됨

- [ ] **Step 0.4: db:push 실행**

Run: `pnpm --filter @ai-signalcraft/core db:push`
Expected: 4개 테이블 + 인덱스 생성 메시지. 기존 테이블 변경 없음

- [ ] **Step 0.5: 테이블 존재 확인**

Run:

```bash
PGPASSWORD=$(grep AIS_DB_PASSWORD /home/gon/projects/ai/ai-signalcraft/.env | cut -d= -f2) \
  psql -h 192.168.0.5 -p 5438 -U ais_app -d ai_signalcraft -c "\dt manipulation_*"
```

Expected: 4개 테이블 (manipulation_runs, manipulation_signals, manipulation_evidence, manipulation_domain_configs) 출력

- [ ] **Step 0.6: 커밋**

```bash
git add packages/core/src/db/schema/manipulation.ts packages/core/src/db/schema/index.ts
git commit -m "feat(core): manipulation 탐지용 4개 테이블 스키마 추가"
```

---

## Task 1: 도메인 설정 시드 스크립트

**Files:**

- Create: `packages/core/src/db/seed-manipulation-configs.ts`
- Modify: `packages/core/package.json`

- [ ] **Step 1.1: 시드 스크립트 작성**

`packages/core/src/db/seed-manipulation-configs.ts`:

```typescript
import 'dotenv/config';
import { db } from './index';
import { manipulationDomainConfigs } from './schema/manipulation';

const POLITICAL_WEIGHTS = {
  burst: 0.18,
  similarity: 0.22,
  vote: 0.14,
  'media-sync': 0.16,
  'trend-shape': 0.1,
  'cross-platform': 0.12,
  temporal: 0.08,
} as const;

const POLITICAL_THRESHOLDS = {
  burst: { medium: 50, high: 70 },
  similarity: { medium: 55, high: 75 },
  vote: { medium: 50, high: 70 },
  'media-sync': { medium: 50, high: 65 },
  'trend-shape': { medium: 50, high: 70 },
  'cross-platform': { medium: 50, high: 70 },
  temporal: { medium: 50, high: 70 },
} as const;

async function seed() {
  await db
    .insert(manipulationDomainConfigs)
    .values({
      domain: 'political',
      weights: POLITICAL_WEIGHTS,
      thresholds: POLITICAL_THRESHOLDS,
      baselineDays: 30,
      narrativeContext:
        '정치 도메인. 매체 동조화·크로스 플랫폼 캐스케이드를 강조한다. 단정적 표현 금지, 관찰된 패턴만 기술.',
    })
    .onConflictDoUpdate({
      target: manipulationDomainConfigs.domain,
      set: {
        weights: POLITICAL_WEIGHTS,
        thresholds: POLITICAL_THRESHOLDS,
        baselineDays: 30,
        narrativeContext:
          '정치 도메인. 매체 동조화·크로스 플랫폼 캐스케이드를 강조한다. 단정적 표현 금지, 관찰된 패턴만 기술.',
        updatedAt: new Date(),
      },
    });

  console.log('[seed-manipulation-configs] political 도메인 설정 적용 완료');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed-manipulation-configs] 실패:', err);
  process.exit(1);
});
```

- [ ] **Step 1.2: package.json에 스크립트 추가**

`packages/core/package.json`의 scripts 섹션에 추가:

```json
"db:seed-manipulation": "tsx src/db/seed-manipulation-configs.ts"
```

- [ ] **Step 1.3: 시드 실행**

Run: `pnpm --filter @ai-signalcraft/core db:seed-manipulation`
Expected: `political 도메인 설정 적용 완료` 출력, exit 0

- [ ] **Step 1.4: row 확인**

Run:

```bash
PGPASSWORD=$(grep AIS_DB_PASSWORD /home/gon/projects/ai/ai-signalcraft/.env | cut -d= -f2) \
  psql -h 192.168.0.5 -p 5438 -U ais_app -d ai_signalcraft \
  -c "SELECT domain, weights->>'similarity' AS sim_weight FROM manipulation_domain_configs;"
```

Expected: `political | 0.22` 출력

- [ ] **Step 1.5: 가중치 합 검증 (수동)**

다음 값들의 합이 1.00 인지 확인: 0.18 + 0.22 + 0.14 + 0.16 + 0.10 + 0.12 + 0.08 = 1.00 ✓

- [ ] **Step 1.6: 커밋**

```bash
git add packages/core/src/db/seed-manipulation-configs.ts packages/core/package.json
git commit -m "feat(core): manipulation political 도메인 가중치/임계치 시드"
```

---

## Task 2: 공통 타입 정의

**Files:**

- Create: `packages/core/src/analysis/manipulation/types.ts`

- [ ] **Step 2.1: 타입 파일 작성**

`packages/core/src/analysis/manipulation/types.ts`:

```typescript
import type { SignalType, Severity } from '../../db/schema/manipulation';

export type { SignalType, Severity };

export type RawRef = {
  itemId: string;
  source: string;
  time: string;
  excerpt: string;
};

export type VisualizationSpec =
  | { kind: 'burst-heatmap'; buckets: { ts: string; count: number; zScore: number }[] }
  | {
      kind: 'similarity-cluster';
      representative: string;
      matches: { author: string | null; source: string; time: string; text: string }[];
    }
  | {
      kind: 'vote-scatter';
      points: { length: number; likes: number; isOutlier: boolean }[];
    }
  | {
      kind: 'media-sync-timeline';
      cluster: string;
      items: { publisher: string | null; time: string; headline: string }[];
    }
  | {
      kind: 'trend-line';
      series: { ts: string; count: number; isChangePoint: boolean }[];
    }
  | {
      kind: 'cross-platform-flow';
      hops: { from: string; to: string; time: string; message: string; count: number }[];
    }
  | {
      kind: 'temporal-bars';
      bars: { hour: number; current: number; baseline: number }[];
    };

export type EvidenceCard = {
  signal: SignalType;
  severity: Severity;
  title: string;
  summary: string;
  visualization: VisualizationSpec;
  rawRefs: RawRef[];
  rank: number;
};

export type SignalResult = {
  signal: SignalType;
  score: number;
  confidence: number;
  evidence: EvidenceCard[];
  metrics: Record<string, number>;
  computeMs: number;
};

export type DomainWeights = Record<SignalType, number>;
export type DomainThresholds = Record<SignalType, { medium: number; high: number }>;

export type DomainConfig = {
  domain: string;
  weights: DomainWeights;
  thresholds: DomainThresholds;
  baselineDays: number;
  narrativeContext: string;
};

export type SignalContext = {
  jobId: number;
  subscriptionId: number | null;
  domain: string;
  config: DomainConfig;
  dateRange: { start: Date; end: Date };
};

export type SignalCalculator = (ctx: SignalContext) => Promise<SignalResult>;
```

- [ ] **Step 2.2: 빌드 확인**

Run: `pnpm --filter @ai-signalcraft/core build`
Expected: 컴파일 성공

- [ ] **Step 2.3: 커밋**

```bash
git add packages/core/src/analysis/manipulation/types.ts
git commit -m "feat(core): manipulation 신호 공통 타입 정의"
```

---

## Task 3: 통계 유틸 (median, MAD, IQR, KL)

**Files:**

- Create: `packages/core/src/analysis/manipulation/utils/stats.ts`
- Test: `packages/core/src/analysis/manipulation/__tests__/utils/stats.test.ts`

- [ ] **Step 3.1: 실패 테스트 작성**

`packages/core/src/analysis/manipulation/__tests__/utils/stats.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { median, mad, iqr, klDivergence } from '../../utils/stats';

describe('stats utils', () => {
  describe('median', () => {
    it('홀수 길이 정렬되지 않은 배열', () => {
      expect(median([3, 1, 2])).toBe(2);
    });
    it('짝수 길이', () => {
      expect(median([1, 2, 3, 4])).toBe(2.5);
    });
    it('빈 배열은 NaN', () => {
      expect(median([])).toBeNaN();
    });
  });

  describe('mad (median absolute deviation)', () => {
    it('동일 값들은 MAD=0', () => {
      expect(mad([5, 5, 5, 5])).toBe(0);
    });
    it('대칭 분포', () => {
      // median=3, |x-3|=[2,1,0,1,2] → median=1
      expect(mad([1, 2, 3, 4, 5])).toBe(1);
    });
  });

  describe('iqr', () => {
    it('Q1=2, Q3=4 → IQR=2', () => {
      expect(iqr([1, 2, 3, 4, 5])).toBeCloseTo(2, 5);
    });
  });

  describe('klDivergence', () => {
    it('동일 분포는 0', () => {
      const p = [0.25, 0.25, 0.25, 0.25];
      expect(klDivergence(p, p)).toBeCloseTo(0, 5);
    });
    it('서로 다른 분포는 양수', () => {
      const p = [0.5, 0.5, 0, 0];
      const q = [0.25, 0.25, 0.25, 0.25];
      expect(klDivergence(p, q)).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 3.2: 테스트 실패 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- utils/stats.test`
Expected: 모든 테스트 FAIL — 모듈 없음

- [ ] **Step 3.3: 구현 작성**

`packages/core/src/analysis/manipulation/utils/stats.ts`:

```typescript
export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function mad(values: number[]): number {
  if (values.length === 0) return NaN;
  const m = median(values);
  return median(values.map((v) => Math.abs(v - m)));
}

export function iqr(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const q1Idx = Math.floor(sorted.length * 0.25);
  const q3Idx = Math.floor(sorted.length * 0.75);
  return sorted[q3Idx] - sorted[q1Idx];
}

// p, q는 정규화된 확률분포 (합=1)이어야 한다
export function klDivergence(p: number[], q: number[]): number {
  if (p.length !== q.length) {
    throw new Error(`klDivergence: 길이 불일치 ${p.length} vs ${q.length}`);
  }
  const eps = 1e-12;
  let sum = 0;
  for (let i = 0; i < p.length; i++) {
    if (p[i] <= 0) continue;
    const qi = q[i] <= 0 ? eps : q[i];
    sum += p[i] * Math.log(p[i] / qi);
  }
  return sum;
}

export function zScore(value: number, m: number, scale: number): number {
  if (scale === 0) return 0;
  return (value - m) / scale;
}

// sigmoid로 z-score를 0~100 점수로 매핑 (z=4에서 약 70)
export function zScoreToScore(z: number): number {
  const absZ = Math.abs(z);
  // 1 / (1 + e^(-(z-2.5)*1.0)) * 100
  const sigmoid = 1 / (1 + Math.exp(-(absZ - 2.5) * 1.0));
  return Math.max(0, Math.min(100, sigmoid * 100));
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
```

- [ ] **Step 3.4: 테스트 통과 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- utils/stats.test`
Expected: 모든 테스트 PASS

- [ ] **Step 3.5: 커밋**

```bash
git add packages/core/src/analysis/manipulation/utils/stats.ts \
  packages/core/src/analysis/manipulation/__tests__/utils/stats.test.ts
git commit -m "feat(core): manipulation 통계 유틸 (median/MAD/IQR/KL/zScore)"
```

---

## Task 4: n-gram Jaccard 유틸

**Files:**

- Create: `packages/core/src/analysis/manipulation/utils/ngram.ts`
- Test: `packages/core/src/analysis/manipulation/__tests__/utils/ngram.test.ts`

- [ ] **Step 4.1: 실패 테스트 작성**

`packages/core/src/analysis/manipulation/__tests__/utils/ngram.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ngramSet, jaccard } from '../../utils/ngram';

describe('ngram utils', () => {
  describe('ngramSet', () => {
    it('짧은 텍스트는 빈 집합', () => {
      expect(ngramSet('abc', 5).size).toBe(0);
    });
    it('5글자 텍스트는 1개 ngram', () => {
      expect(ngramSet('abcde', 5).size).toBe(1);
    });
    it('정확한 ngram 수 (길이 - n + 1)', () => {
      expect(ngramSet('abcdefgh', 5).size).toBe(4);
    });
    it('공백 정규화', () => {
      expect(ngramSet('a  b  c', 3)).toEqual(ngramSet('a b c', 3));
    });
  });

  describe('jaccard', () => {
    it('동일 집합은 1', () => {
      const s = new Set(['a', 'b', 'c']);
      expect(jaccard(s, s)).toBe(1);
    });
    it('교집합 없음은 0', () => {
      expect(jaccard(new Set(['a']), new Set(['b']))).toBe(0);
    });
    it('절반 겹침은 1/3 (교집합 1, 합집합 3)', () => {
      expect(jaccard(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(1 / 3, 5);
    });
    it('빈 집합 두 개는 0', () => {
      expect(jaccard(new Set(), new Set())).toBe(0);
    });
  });
});
```

- [ ] **Step 4.2: 테스트 실패 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- utils/ngram.test`
Expected: FAIL

- [ ] **Step 4.3: 구현 작성**

`packages/core/src/analysis/manipulation/utils/ngram.ts`:

```typescript
export function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function ngramSet(text: string, n: number): Set<string> {
  const normalized = normalize(text);
  const set = new Set<string>();
  if (normalized.length < n) return set;
  for (let i = 0; i <= normalized.length - n; i++) {
    set.add(normalized.slice(i, i + n));
  }
  return set;
}

export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  const smaller = a.size <= b.size ? a : b;
  const larger = a.size <= b.size ? b : a;
  for (const v of smaller) {
    if (larger.has(v)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
```

- [ ] **Step 4.4: 테스트 통과 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- utils/ngram.test`
Expected: PASS

- [ ] **Step 4.5: 커밋**

```bash
git add packages/core/src/analysis/manipulation/utils/ngram.ts \
  packages/core/src/analysis/manipulation/__tests__/utils/ngram.test.ts
git commit -m "feat(core): manipulation n-gram Jaccard 유틸"
```

---

## Task 5: S1 Burst Detector

**Files:**

- Create: `packages/core/src/analysis/manipulation/signals/burst.ts`
- Test: `packages/core/src/analysis/manipulation/__tests__/burst.test.ts`

- [ ] **Step 5.1: 실패 테스트 작성**

`packages/core/src/analysis/manipulation/__tests__/burst.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeBurstFromComments, BUCKET_MS } from '../signals/burst';
import type { CommentRow } from '../signals/burst';

function makeComment(parentId: string, isoTime: string): CommentRow {
  return {
    itemId: `${parentId}-${isoTime}`,
    parentSourceId: parentId,
    source: 'dcinside',
    time: new Date(isoTime),
    excerpt: '',
  };
}

describe('burst signal', () => {
  it('정상 분포는 낮은 점수', () => {
    const comments: CommentRow[] = [];
    // 부모1: 1시간 동안 12개 균등 분포 (5분당 1개)
    for (let i = 0; i < 12; i++) {
      const min = String(i * 5).padStart(2, '0');
      comments.push(makeComment('p1', `2026-04-27T10:${min}:00Z`));
    }
    const result = computeBurstFromComments(comments);
    expect(result.score).toBeLessThan(40);
    expect(result.metrics.maxZ).toBeLessThan(2);
  });

  it('강한 burst (5분에 30개) 는 70점 이상', () => {
    const comments: CommentRow[] = [];
    // 평소: 1시간 동안 5분 bucket마다 1개 (12 buckets × 1)
    for (let i = 0; i < 12; i++) {
      const min = String(i * 5).padStart(2, '0');
      comments.push(makeComment('p1', `2026-04-27T08:${min}:00Z`));
    }
    // burst: 한 5분 bucket에 30개
    for (let i = 0; i < 30; i++) {
      const sec = String(i * 2).padStart(2, '0');
      comments.push(makeComment('p1', `2026-04-27T10:00:${sec}:00`.replace('::00', '')));
    }
    const result = computeBurstFromComments(comments);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.evidence[0].severity).toBe('high');
  });

  it('데이터 부족 (5건 미만) 은 confidence 낮음', () => {
    const comments: CommentRow[] = [
      makeComment('p1', '2026-04-27T10:00:00Z'),
      makeComment('p1', '2026-04-27T10:01:00Z'),
    ];
    const result = computeBurstFromComments(comments);
    expect(result.confidence).toBeLessThan(0.3);
  });

  it('5분 bucket 크기 상수 검증', () => {
    expect(BUCKET_MS).toBe(5 * 60 * 1000);
  });
});
```

- [ ] **Step 5.2: 테스트 실패 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- burst.test`
Expected: FAIL

- [ ] **Step 5.3: 구현 작성**

`packages/core/src/analysis/manipulation/signals/burst.ts`:

```typescript
import { median, mad, zScore, zScoreToScore } from '../utils/stats';
import type { SignalResult, EvidenceCard } from '../types';

export const BUCKET_MS = 5 * 60 * 1000;
const MIN_SAMPLES_FOR_FULL_CONFIDENCE = 30;

export type CommentRow = {
  itemId: string;
  parentSourceId: string;
  source: string;
  time: Date;
  excerpt: string;
};

export function computeBurstFromComments(comments: CommentRow[]): SignalResult {
  const t0 = Date.now();
  if (comments.length === 0) {
    return emptyResult(Date.now() - t0);
  }

  const byParent = new Map<string, CommentRow[]>();
  for (const c of comments) {
    if (!byParent.has(c.parentSourceId)) byParent.set(c.parentSourceId, []);
    byParent.get(c.parentSourceId)!.push(c);
  }

  let maxZ = 0;
  let topBuckets: {
    parentId: string;
    ts: string;
    count: number;
    zScore: number;
    samples: CommentRow[];
  }[] = [];

  for (const [parentId, list] of byParent) {
    if (list.length < 5) continue;
    const counts = new Map<number, CommentRow[]>();
    for (const c of list) {
      const bucket = Math.floor(c.time.getTime() / BUCKET_MS) * BUCKET_MS;
      if (!counts.has(bucket)) counts.set(bucket, []);
      counts.get(bucket)!.push(c);
    }
    const values = Array.from(counts.values()).map((arr) => arr.length);
    if (values.length < 3) continue;
    const m = median(values);
    const scale = mad(values) * 1.4826 || 1; // 1.4826 = MAD→σ 보정
    for (const [bucket, items] of counts) {
      const z = zScore(items.length, m, scale);
      if (z > maxZ) maxZ = z;
      if (z >= 3) {
        topBuckets.push({
          parentId,
          ts: new Date(bucket).toISOString(),
          count: items.length,
          zScore: z,
          samples: items.slice(0, 5),
        });
      }
    }
  }

  topBuckets.sort((a, b) => b.zScore - a.zScore);
  const evidence: EvidenceCard[] = topBuckets.slice(0, 10).map((b, idx) => ({
    signal: 'burst',
    severity: b.zScore >= 5 ? 'high' : b.zScore >= 4 ? 'medium' : 'low',
    title: `5분간 댓글 ${b.count}개 집중 (z=${b.zScore.toFixed(1)})`,
    summary: `parent_source_id=${b.parentId}, 시간 ${b.ts}`,
    visualization: {
      kind: 'burst-heatmap',
      buckets: [{ ts: b.ts, count: b.count, zScore: b.zScore }],
    },
    rawRefs: b.samples.map((s) => ({
      itemId: s.itemId,
      source: s.source,
      time: s.time.toISOString(),
      excerpt: s.excerpt,
    })),
    rank: idx,
  }));

  const score = zScoreToScore(maxZ);
  const confidence = Math.min(1, comments.length / MIN_SAMPLES_FOR_FULL_CONFIDENCE);

  return {
    signal: 'burst',
    score,
    confidence,
    evidence,
    metrics: { maxZ, parentCount: byParent.size, sampleCount: comments.length },
    computeMs: Date.now() - t0,
  };
}

function emptyResult(computeMs: number): SignalResult {
  return {
    signal: 'burst',
    score: 0,
    confidence: 0,
    evidence: [],
    metrics: { maxZ: 0, parentCount: 0, sampleCount: 0 },
    computeMs,
  };
}
```

- [ ] **Step 5.4: 테스트 통과 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- burst.test`
Expected: PASS (4 tests)

- [ ] **Step 5.5: 커밋**

```bash
git add packages/core/src/analysis/manipulation/signals/burst.ts \
  packages/core/src/analysis/manipulation/__tests__/burst.test.ts
git commit -m "feat(core): S1 burst detection (5분 bucket z-score)"
```

---

## Task 6: S8 Temporal Anomaly

**Files:**

- Create: `packages/core/src/analysis/manipulation/signals/temporal.ts`
- Test: `packages/core/src/analysis/manipulation/__tests__/temporal.test.ts`

- [ ] **Step 6.1: 실패 테스트 작성**

`packages/core/src/analysis/manipulation/__tests__/temporal.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeTemporalAnomaly } from '../signals/temporal';
import type { CommentRow } from '../signals/burst';

function comment(hour: number, source = 'dcinside'): CommentRow {
  return {
    itemId: `c-${hour}-${Math.random()}`,
    parentSourceId: 'p1',
    source,
    time: new Date(`2026-04-27T${String(hour).padStart(2, '0')}:30:00Z`),
    excerpt: '',
  };
}

describe('temporal anomaly signal', () => {
  it('baseline과 동일 분포는 낮은 점수', () => {
    const baseline = Array(24).fill(1 / 24);
    const current: CommentRow[] = [];
    for (let h = 0; h < 24; h++) current.push(comment(h));
    const result = computeTemporalAnomaly(current, { dcinside: baseline });
    expect(result.score).toBeLessThan(30);
  });

  it('새벽 집중 (3~5시) 은 높은 점수', () => {
    // baseline: 평일 분포 — 9~22시 활성, 새벽 거의 없음
    const baseline = Array(24).fill(0);
    for (let h = 9; h < 23; h++) baseline[h] = 1 / 14;
    const current: CommentRow[] = [];
    for (let i = 0; i < 50; i++) current.push(comment(3 + (i % 3)));
    const result = computeTemporalAnomaly(current, { dcinside: baseline });
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it('빈 입력은 confidence 0', () => {
    const baseline = Array(24).fill(1 / 24);
    const result = computeTemporalAnomaly([], { dcinside: baseline });
    expect(result.confidence).toBe(0);
  });
});
```

- [ ] **Step 6.2: 테스트 실패 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- temporal.test`
Expected: FAIL

- [ ] **Step 6.3: 구현 작성**

`packages/core/src/analysis/manipulation/signals/temporal.ts`:

```typescript
import { klDivergence, clamp } from '../utils/stats';
import type { SignalResult, EvidenceCard } from '../types';
import type { CommentRow } from './burst';

const MIN_SAMPLES_FOR_CONFIDENCE = 50;

export function computeTemporalAnomaly(
  comments: CommentRow[],
  baselineBySource: Record<string, number[]>,
): SignalResult {
  const t0 = Date.now();
  if (comments.length === 0) {
    return {
      signal: 'temporal',
      score: 0,
      confidence: 0,
      evidence: [],
      metrics: { kl: 0, sampleCount: 0 },
      computeMs: Date.now() - t0,
    };
  }

  const bySource = new Map<string, number[]>();
  for (const c of comments) {
    if (!bySource.has(c.source)) bySource.set(c.source, Array(24).fill(0));
    const hour = c.time.getUTCHours();
    bySource.get(c.source)![hour] += 1;
  }

  let maxKl = 0;
  let worstSource = '';
  let worstHist: number[] = [];
  let worstBaseline: number[] = [];
  for (const [source, hist] of bySource) {
    const total = hist.reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    const p = hist.map((v) => v / total);
    const baseline = baselineBySource[source];
    if (!baseline || baseline.length !== 24) continue;
    const kl = klDivergence(p, baseline);
    if (kl > maxKl) {
      maxKl = kl;
      worstSource = source;
      worstHist = hist;
      worstBaseline = baseline;
    }
  }

  const score = clamp(maxKl >= 1 ? 70 + (maxKl - 1) * 15 : maxKl * 70, 0, 100);
  const confidence = Math.min(1, comments.length / MIN_SAMPLES_FOR_CONFIDENCE);

  const evidence: EvidenceCard[] = [];
  if (worstSource && maxKl > 0.3) {
    const total = worstHist.reduce((a, b) => a + b, 0);
    evidence.push({
      signal: 'temporal',
      severity: maxKl >= 1 ? 'high' : maxKl >= 0.5 ? 'medium' : 'low',
      title: `${worstSource} 시간대 분포 이상 (KL=${maxKl.toFixed(2)})`,
      summary: `현재 분포가 baseline 대비 비정상`,
      visualization: {
        kind: 'temporal-bars',
        bars: Array.from({ length: 24 }, (_, h) => ({
          hour: h,
          current: worstHist[h] / total,
          baseline: worstBaseline[h],
        })),
      },
      rawRefs: [],
      rank: 0,
    });
  }

  return {
    signal: 'temporal',
    score,
    confidence,
    evidence,
    metrics: { kl: maxKl, sampleCount: comments.length },
    computeMs: Date.now() - t0,
  };
}
```

- [ ] **Step 6.4: 테스트 통과 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- temporal.test`
Expected: PASS

- [ ] **Step 6.5: 커밋**

```bash
git add packages/core/src/analysis/manipulation/signals/temporal.ts \
  packages/core/src/analysis/manipulation/__tests__/temporal.test.ts
git commit -m "feat(core): S8 temporal anomaly (KL divergence)"
```

---

## Task 7: S6 Trend Shape

**Files:**

- Create: `packages/core/src/analysis/manipulation/signals/trend-shape.ts`
- Test: `packages/core/src/analysis/manipulation/__tests__/trend-shape.test.ts`

- [ ] **Step 7.1: 실패 테스트 작성**

`packages/core/src/analysis/manipulation/__tests__/trend-shape.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeTrendShape } from '../signals/trend-shape';

describe('trend-shape signal', () => {
  it('자연 확산 (점진 상승 후 감소) 은 낮은 점수', () => {
    // 가우시안 모양: 1,2,4,7,10,12,10,7,4,2,1
    const series = [1, 2, 4, 7, 10, 12, 10, 7, 4, 2, 1].map((count, i) => ({
      ts: new Date(2026, 3, 27, i).toISOString(),
      count,
    }));
    const result = computeTrendShape(series);
    expect(result.score).toBeLessThan(45);
  });

  it('계단형 점프 (평평→급등→고원) 는 높은 점수', () => {
    const series = [1, 1, 1, 1, 1, 50, 52, 51, 49, 50, 1, 1, 1].map((count, i) => ({
      ts: new Date(2026, 3, 27, i).toISOString(),
      count,
    }));
    const result = computeTrendShape(series);
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.metrics.jumpRatio).toBeGreaterThanOrEqual(20);
  });

  it('짧은 시리즈는 confidence 낮음', () => {
    const series = [{ ts: new Date().toISOString(), count: 5 }];
    const result = computeTrendShape(series);
    expect(result.confidence).toBeLessThan(0.3);
  });
});
```

- [ ] **Step 7.2: 테스트 실패 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- trend-shape.test`
Expected: FAIL

- [ ] **Step 7.3: 구현 작성**

`packages/core/src/analysis/manipulation/signals/trend-shape.ts`:

```typescript
import { clamp } from '../utils/stats';
import type { SignalResult, EvidenceCard } from '../types';

const MIN_POINTS = 8;

export type TrendPoint = { ts: string; count: number };

export function computeTrendShape(series: TrendPoint[]): SignalResult {
  const t0 = Date.now();
  if (series.length < MIN_POINTS) {
    return {
      signal: 'trend-shape',
      score: 0,
      confidence: Math.min(1, series.length / MIN_POINTS),
      evidence: [],
      metrics: { jumpRatio: 0, points: series.length },
      computeMs: Date.now() - t0,
    };
  }

  const counts = series.map((p) => p.count);
  const max = Math.max(...counts);
  const peakIdx = counts.indexOf(max);
  const prePeak = counts.slice(0, peakIdx);
  const baseline = prePeak.length > 0 ? Math.max(1, average(prePeak)) : 1;
  const jumpRatio = max / baseline;

  // 평탄도: peak 주변 ±2 구간의 변동계수 역수 (낮을수록 평평한 고원)
  const window = counts.slice(Math.max(0, peakIdx - 2), Math.min(counts.length, peakIdx + 3));
  const cv = stdDev(window) / (average(window) || 1);
  const flatness = clamp(1 - cv, 0, 1);

  const score = clamp(Math.log10(jumpRatio + 1) * 30 + flatness * 40, 0, 100);
  const confidence = Math.min(1, series.length / 14);

  const changeIdx = detectChangePoint(counts);

  const evidence: EvidenceCard[] = [];
  if (jumpRatio >= 5) {
    evidence.push({
      signal: 'trend-shape',
      severity: jumpRatio >= 20 ? 'high' : jumpRatio >= 10 ? 'medium' : 'low',
      title: `평소 대비 ${jumpRatio.toFixed(1)}배 급등 (평탄도 ${flatness.toFixed(2)})`,
      summary: `${series[peakIdx].ts} 부근 피크`,
      visualization: {
        kind: 'trend-line',
        series: series.map((p, i) => ({
          ts: p.ts,
          count: p.count,
          isChangePoint: i === changeIdx,
        })),
      },
      rawRefs: [],
      rank: 0,
    });
  }

  return {
    signal: 'trend-shape',
    score,
    confidence,
    evidence,
    metrics: { jumpRatio, flatness, points: series.length },
    computeMs: Date.now() - t0,
  };
}

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length === 0) return 0;
  const m = average(arr);
  return Math.sqrt(average(arr.map((v) => (v - m) ** 2)));
}

// 단순 ratio rule 변화점: 1차 차분이 baseline의 5배 이상인 첫 인덱스
function detectChangePoint(counts: number[]): number {
  if (counts.length < 3) return -1;
  const first3Avg = average(counts.slice(0, 3)) || 1;
  for (let i = 3; i < counts.length; i++) {
    if (counts[i] - counts[i - 1] >= first3Avg * 5) return i;
  }
  return -1;
}
```

- [ ] **Step 7.4: 테스트 통과 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- trend-shape.test`
Expected: PASS

- [ ] **Step 7.5: 커밋**

```bash
git add packages/core/src/analysis/manipulation/signals/trend-shape.ts \
  packages/core/src/analysis/manipulation/__tests__/trend-shape.test.ts
git commit -m "feat(core): S6 trend shape (jump ratio + 평탄도)"
```

---

## Task 8: S4 Vote Anomaly

**Files:**

- Create: `packages/core/src/analysis/manipulation/signals/vote.ts`
- Test: `packages/core/src/analysis/manipulation/__tests__/vote.test.ts`

- [ ] **Step 8.1: 실패 테스트 작성**

`packages/core/src/analysis/manipulation/__tests__/vote.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeVoteAnomaly } from '../signals/vote';

type VoteRow = {
  itemId: string;
  source: string;
  parentSourceId: string;
  length: number;
  likeCount: number;
  time: Date;
};

function row(parent: string, length: number, likes: number): VoteRow {
  return {
    itemId: `${parent}-${length}-${likes}-${Math.random()}`,
    source: 'dcinside',
    parentSourceId: parent,
    length,
    likeCount: likes,
    time: new Date('2026-04-27T10:00:00Z'),
  };
}

describe('vote anomaly signal', () => {
  it('정상 분포는 낮은 점수', () => {
    const rows = Array.from({ length: 30 }, (_, i) => row('p1', 50 + i, i + 1));
    const result = computeVoteAnomaly(rows);
    expect(result.score).toBeLessThan(40);
  });

  it('짧은 댓글에 비정상 추천 다수는 높은 점수', () => {
    const rows = Array.from({ length: 30 }, (_, i) => row('p1', 50 + i, 1 + (i % 5)));
    // 짧은 댓글 5개에 매우 큰 좋아요
    for (let i = 0; i < 5; i++) rows.push(row('p1', 5, 200 + i * 50));
    const result = computeVoteAnomaly(rows);
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it('빈 입력은 confidence 0', () => {
    const result = computeVoteAnomaly([]);
    expect(result.confidence).toBe(0);
  });
});

export type { VoteRow };
```

- [ ] **Step 8.2: 테스트 실패 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- vote.test`
Expected: FAIL

- [ ] **Step 8.3: 구현 작성**

`packages/core/src/analysis/manipulation/signals/vote.ts`:

```typescript
import { iqr, clamp } from '../utils/stats';
import type { SignalResult, EvidenceCard } from '../types';

const MIN_SAMPLES_FOR_CONFIDENCE = 30;

export type VoteRow = {
  itemId: string;
  source: string;
  parentSourceId: string;
  length: number;
  likeCount: number;
  time: Date;
};

export function computeVoteAnomaly(rows: VoteRow[]): SignalResult {
  const t0 = Date.now();
  if (rows.length === 0) {
    return {
      signal: 'vote',
      score: 0,
      confidence: 0,
      evidence: [],
      metrics: { outlierRatio: 0, sampleCount: 0 },
      computeMs: Date.now() - t0,
    };
  }

  // 게시물별 IQR 이상치 탐지 + 길이 회귀 잔차
  const byParent = new Map<string, VoteRow[]>();
  for (const r of rows) {
    if (!byParent.has(r.parentSourceId)) byParent.set(r.parentSourceId, []);
    byParent.get(r.parentSourceId)!.push(r);
  }

  let outliers: { row: VoteRow; expected: number; residual: number }[] = [];
  let totalCount = 0;
  for (const [, list] of byParent) {
    if (list.length < 5) continue;
    const likes = list.map((r) => r.likeCount);
    const sortedLikes = [...likes].sort((a, b) => a - b);
    const q3 = sortedLikes[Math.floor(sortedLikes.length * 0.75)];
    const range = iqr(likes);
    const upper = q3 + 1.5 * range;

    // 단순 선형 회귀: like ~ length
    const meanLen = list.reduce((s, r) => s + r.length, 0) / list.length;
    const meanLike = list.reduce((s, r) => s + r.likeCount, 0) / list.length;
    let num = 0;
    let den = 0;
    for (const r of list) {
      num += (r.length - meanLen) * (r.likeCount - meanLike);
      den += (r.length - meanLen) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    const intercept = meanLike - slope * meanLen;

    for (const r of list) {
      const expected = slope * r.length + intercept;
      const residual = r.likeCount - expected;
      if (r.likeCount > upper && residual > range) {
        outliers.push({ row: r, expected, residual });
      }
    }
    totalCount += list.length;
  }

  const outlierRatio = totalCount === 0 ? 0 : outliers.length / totalCount;
  const score = clamp(outlierRatio * 500, 0, 100); // 20% 이상치 → 100점
  const confidence = Math.min(1, rows.length / MIN_SAMPLES_FOR_CONFIDENCE);

  outliers.sort((a, b) => b.residual - a.residual);
  const evidence: EvidenceCard[] = [];
  if (outliers.length > 0) {
    const top = outliers.slice(0, 20);
    evidence.push({
      signal: 'vote',
      severity: outlierRatio >= 0.15 ? 'high' : outlierRatio >= 0.05 ? 'medium' : 'low',
      title: `비정상 추천 ${outliers.length}건 (전체 ${totalCount}건 중)`,
      summary: `짧은 댓글이 비정상적으로 높은 좋아요`,
      visualization: {
        kind: 'vote-scatter',
        points: top.map((o) => ({
          length: o.row.length,
          likes: o.row.likeCount,
          isOutlier: true,
        })),
      },
      rawRefs: top.map((o) => ({
        itemId: o.row.itemId,
        source: o.row.source,
        time: o.row.time.toISOString(),
        excerpt: '',
      })),
      rank: 0,
    });
  }

  return {
    signal: 'vote',
    score,
    confidence,
    evidence,
    metrics: { outlierRatio, sampleCount: rows.length, outlierCount: outliers.length },
    computeMs: Date.now() - t0,
  };
}
```

- [ ] **Step 8.4: 테스트 통과 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- vote.test`
Expected: PASS

- [ ] **Step 8.5: 커밋**

```bash
git add packages/core/src/analysis/manipulation/signals/vote.ts \
  packages/core/src/analysis/manipulation/__tests__/vote.test.ts
git commit -m "feat(core): S4 vote anomaly (IQR + 길이 회귀 잔차)"
```

---

## Task 9: S3 Text Similarity

**Files:**

- Create: `packages/core/src/analysis/manipulation/signals/similarity.ts`
- Test: `packages/core/src/analysis/manipulation/__tests__/similarity.test.ts`

S3는 pgvector 의존성이 있으므로, 단위 테스트는 임베딩 비교 로직을 **순수 함수**로 분리해서 테스트하고, DB 쿼리 부분은 Task 13(runner.test.ts)에서 다룹니다.

- [ ] **Step 9.1: 실패 테스트 작성**

`packages/core/src/analysis/manipulation/__tests__/similarity.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { cosineSimilarity, buildSimilarityClusters, scoreClusters } from '../signals/similarity';
import type { EmbeddedItem } from '../signals/similarity';

function item(
  id: string,
  source: string,
  author: string | null,
  text: string,
  emb: number[],
  isoTime: string,
): EmbeddedItem {
  return {
    itemId: id,
    source,
    author,
    text,
    embedding: emb,
    time: new Date(isoTime),
  };
}

describe('similarity signal', () => {
  describe('cosineSimilarity', () => {
    it('동일 벡터는 1', () => {
      expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    });
    it('직교 벡터는 0', () => {
      expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    });
  });

  describe('buildSimilarityClusters', () => {
    it('유사도 임계 미만은 클러스터 안 만듦', () => {
      const items = [
        item('a', 'dcinside', 'u1', '안녕하세요', [1, 0], '2026-04-27T10:00:00Z'),
        item('b', 'clien', 'u2', '반갑습니다', [0, 1], '2026-04-27T10:01:00Z'),
      ];
      const clusters = buildSimilarityClusters(items, { cosineMin: 0.92, jaccardMin: 0.6 });
      expect(clusters.length).toBe(0);
    });

    it('동일 텍스트 + 다른 작성자 + 다른 source 는 클러스터 형성', () => {
      const text = '이번 정책은 정말 우려스러운 부분이 많습니다 신중히 생각해야 합니다';
      const emb = [0.9, 0.1];
      const items = [
        item('a', 'dcinside', 'u1', text, emb, '2026-04-27T10:00:00Z'),
        item('b', 'clien', 'u2', text, emb, '2026-04-27T10:02:00Z'),
        item('c', 'fmkorea', 'u3', text, emb, '2026-04-27T10:05:00Z'),
      ];
      const clusters = buildSimilarityClusters(items, { cosineMin: 0.85, jaccardMin: 0.5 });
      expect(clusters.length).toBeGreaterThanOrEqual(1);
      expect(clusters[0].members.length).toBe(3);
      expect(clusters[0].sourceSet.size).toBe(3);
    });
  });

  describe('scoreClusters', () => {
    it('클러스터 없으면 score 0', () => {
      const result = scoreClusters([]);
      expect(result.score).toBe(0);
    });

    it('큰 클러스터 + 다양한 작성자 = 높은 점수', () => {
      const result = scoreClusters([
        {
          representative: 'X',
          members: Array.from({ length: 8 }, (_, i) => ({
            itemId: `${i}`,
            source: i < 4 ? 'dcinside' : 'clien',
            author: `u${i}`,
            text: 'X',
            time: new Date(`2026-04-27T10:0${i}:00Z`),
          })),
          sourceSet: new Set(['dcinside', 'clien']),
          authorSet: new Set(['u0', 'u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7']),
          timeSpanMs: 8 * 60 * 1000,
        },
      ]);
      expect(result.score).toBeGreaterThanOrEqual(60);
    });
  });
});
```

- [ ] **Step 9.2: 테스트 실패 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- similarity.test`
Expected: FAIL

- [ ] **Step 9.3: 구현 작성**

`packages/core/src/analysis/manipulation/signals/similarity.ts`:

```typescript
import { ngramSet, jaccard } from '../utils/ngram';
import { clamp } from '../utils/stats';
import type { SignalResult, EvidenceCard } from '../types';

export type EmbeddedItem = {
  itemId: string;
  source: string;
  author: string | null;
  text: string;
  embedding: number[];
  time: Date;
};

export type ClusterMember = {
  itemId: string;
  source: string;
  author: string | null;
  text: string;
  time: Date;
};

export type SimilarityCluster = {
  representative: string;
  members: ClusterMember[];
  sourceSet: Set<string>;
  authorSet: Set<string>;
  timeSpanMs: number;
};

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}

export function buildSimilarityClusters(
  items: EmbeddedItem[],
  opts: { cosineMin: number; jaccardMin: number },
): SimilarityCluster[] {
  const visited = new Set<number>();
  const clusters: SimilarityCluster[] = [];

  // 단순 O(n^2) 검색 — 1만 미만에서 동작. 큰 데이터는 pgvector HNSW로 대체 (runner)
  for (let i = 0; i < items.length; i++) {
    if (visited.has(i)) continue;
    const cluster: ClusterMember[] = [
      {
        itemId: items[i].itemId,
        source: items[i].source,
        author: items[i].author,
        text: items[i].text,
        time: items[i].time,
      },
    ];
    visited.add(i);
    const ngramI = ngramSet(items[i].text, 5);
    for (let j = i + 1; j < items.length; j++) {
      if (visited.has(j)) continue;
      const cos = cosineSimilarity(items[i].embedding, items[j].embedding);
      if (cos < opts.cosineMin) continue;
      const ngramJ = ngramSet(items[j].text, 5);
      if (jaccard(ngramI, ngramJ) < opts.jaccardMin) continue;
      cluster.push({
        itemId: items[j].itemId,
        source: items[j].source,
        author: items[j].author,
        text: items[j].text,
        time: items[j].time,
      });
      visited.add(j);
    }
    if (cluster.length >= 2) {
      const times = cluster.map((m) => m.time.getTime());
      clusters.push({
        representative: items[i].text,
        members: cluster,
        sourceSet: new Set(cluster.map((m) => m.source)),
        authorSet: new Set(cluster.map((m) => m.author).filter(Boolean) as string[]),
        timeSpanMs: Math.max(...times) - Math.min(...times),
      });
    }
  }
  return clusters;
}

export function scoreClusters(clusters: SimilarityCluster[]): {
  score: number;
  evidence: EvidenceCard[];
  metrics: Record<string, number>;
} {
  if (clusters.length === 0) {
    return {
      score: 0,
      evidence: [],
      metrics: { clusterCount: 0, maxClusterSize: 0 },
    };
  }

  let topScore = 0;
  for (const c of clusters) {
    const sizeScore = clamp(Math.log2(c.members.length) * 25, 0, 60);
    const authorDiversity = c.authorSet.size / Math.max(1, c.members.length);
    const sourceBonus = Math.min(20, c.sourceSet.size * 8);
    const speedBonus =
      c.timeSpanMs < 30 * 60 * 1000 ? 20 : c.timeSpanMs < 2 * 60 * 60 * 1000 ? 10 : 0;
    const s = sizeScore + authorDiversity * 30 + sourceBonus + speedBonus;
    if (s > topScore) topScore = s;
  }
  topScore = clamp(topScore, 0, 100);

  clusters.sort((a, b) => b.members.length - a.members.length);
  const evidence: EvidenceCard[] = clusters.slice(0, 10).map((c, idx) => ({
    signal: 'similarity',
    severity: c.members.length >= 8 ? 'high' : c.members.length >= 4 ? 'medium' : 'low',
    title: `동일 문구 ${c.members.length}회 (${c.sourceSet.size}개 source, ${c.authorSet.size}명)`,
    summary: c.representative.slice(0, 80),
    visualization: {
      kind: 'similarity-cluster',
      representative: c.representative,
      matches: c.members.map((m) => ({
        author: m.author,
        source: m.source,
        time: m.time.toISOString(),
        text: m.text,
      })),
    },
    rawRefs: c.members.map((m) => ({
      itemId: m.itemId,
      source: m.source,
      time: m.time.toISOString(),
      excerpt: m.text.slice(0, 200),
    })),
    rank: idx,
  }));

  return {
    score: topScore,
    evidence,
    metrics: {
      clusterCount: clusters.length,
      maxClusterSize: clusters[0]?.members.length ?? 0,
    },
  };
}

export function computeSimilarity(items: EmbeddedItem[]): SignalResult {
  const t0 = Date.now();
  if (items.length === 0) {
    return {
      signal: 'similarity',
      score: 0,
      confidence: 0,
      evidence: [],
      metrics: { clusterCount: 0, maxClusterSize: 0 },
      computeMs: Date.now() - t0,
    };
  }
  const clusters = buildSimilarityClusters(items, { cosineMin: 0.92, jaccardMin: 0.6 });
  const { score, evidence, metrics } = scoreClusters(clusters);
  const confidence = Math.min(1, items.length / 200);
  return {
    signal: 'similarity',
    score,
    confidence,
    evidence,
    metrics: { ...metrics, sampleCount: items.length },
    computeMs: Date.now() - t0,
  };
}

// S7가 소비할 클러스터 raw 데이터 export
export function extractClustersForCrossPlatform(items: EmbeddedItem[]): SimilarityCluster[] {
  return buildSimilarityClusters(items, { cosineMin: 0.92, jaccardMin: 0.6 });
}
```

- [ ] **Step 9.4: 테스트 통과 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- similarity.test`
Expected: PASS

- [ ] **Step 9.5: 커밋**

```bash
git add packages/core/src/analysis/manipulation/signals/similarity.ts \
  packages/core/src/analysis/manipulation/__tests__/similarity.test.ts
git commit -m "feat(core): S3 text similarity (cosine + n-gram Jaccard)"
```

---

## Task 10: S7 Cross-Platform (S3 후처리)

**Files:**

- Create: `packages/core/src/analysis/manipulation/signals/cross-platform.ts`
- Test: `packages/core/src/analysis/manipulation/__tests__/cross-platform.test.ts`

- [ ] **Step 10.1: 실패 테스트 작성**

`packages/core/src/analysis/manipulation/__tests__/cross-platform.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeCrossPlatform } from '../signals/cross-platform';
import type { SimilarityCluster } from '../signals/similarity';

function cluster(sources: string[], spanMin: number): SimilarityCluster {
  const baseTs = Date.parse('2026-04-27T10:00:00Z');
  return {
    representative: 'X',
    members: sources.map((s, i) => ({
      itemId: `${s}-${i}`,
      source: s,
      author: `u${i}`,
      text: 'X',
      time: new Date(baseTs + (i * spanMin * 60 * 1000) / Math.max(1, sources.length - 1)),
    })),
    sourceSet: new Set(sources),
    authorSet: new Set(sources.map((_, i) => `u${i}`)),
    timeSpanMs: spanMin * 60 * 1000,
  };
}

describe('cross-platform signal', () => {
  it('단일 플랫폼 클러스터는 점수 0', () => {
    const c = cluster(['dcinside', 'dcinside', 'dcinside'], 10);
    const result = computeCrossPlatform([c]);
    expect(result.score).toBe(0);
  });

  it('3개 플랫폼 + 짧은 시간 = 높은 점수', () => {
    const c = cluster(['dcinside', 'youtube', 'naver-news'], 15);
    const result = computeCrossPlatform([c]);
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.evidence.length).toBe(1);
  });

  it('빈 입력은 confidence 0', () => {
    const result = computeCrossPlatform([]);
    expect(result.confidence).toBe(0);
  });
});
```

- [ ] **Step 10.2: 테스트 실패 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- cross-platform.test`
Expected: FAIL

- [ ] **Step 10.3: 구현 작성**

`packages/core/src/analysis/manipulation/signals/cross-platform.ts`:

```typescript
import { clamp } from '../utils/stats';
import type { SignalResult, EvidenceCard } from '../types';
import type { SimilarityCluster } from './similarity';

export function computeCrossPlatform(clusters: SimilarityCluster[]): SignalResult {
  const t0 = Date.now();
  if (clusters.length === 0) {
    return {
      signal: 'cross-platform',
      score: 0,
      confidence: 0,
      evidence: [],
      metrics: { multiPlatformClusters: 0 },
      computeMs: Date.now() - t0,
    };
  }

  const multi = clusters.filter((c) => c.sourceSet.size >= 2);
  if (multi.length === 0) {
    return {
      signal: 'cross-platform',
      score: 0,
      confidence: 1,
      evidence: [],
      metrics: { multiPlatformClusters: 0, totalClusters: clusters.length },
      computeMs: Date.now() - t0,
    };
  }

  let topScore = 0;
  for (const c of multi) {
    const platformBonus = Math.min(60, c.sourceSet.size * 25);
    const speedBonus = c.timeSpanMs < 15 * 60 * 1000 ? 30 : c.timeSpanMs < 60 * 60 * 1000 ? 15 : 5;
    const s = platformBonus + speedBonus;
    if (s > topScore) topScore = s;
  }
  const score = clamp(topScore, 0, 100);

  const evidence: EvidenceCard[] = multi.slice(0, 10).map((c, idx) => {
    const sortedMembers = [...c.members].sort((a, b) => a.time.getTime() - b.time.getTime());
    const hops: { from: string; to: string; time: string; message: string; count: number }[] = [];
    for (let i = 1; i < sortedMembers.length; i++) {
      hops.push({
        from: sortedMembers[i - 1].source,
        to: sortedMembers[i].source,
        time: sortedMembers[i].time.toISOString(),
        message: c.representative.slice(0, 60),
        count: 1,
      });
    }
    return {
      signal: 'cross-platform',
      severity: c.sourceSet.size >= 3 ? 'high' : 'medium',
      title: `${c.sourceSet.size}개 플랫폼 동시 출현 (${Math.round(c.timeSpanMs / 60000)}분)`,
      summary: c.representative.slice(0, 80),
      visualization: { kind: 'cross-platform-flow', hops },
      rawRefs: c.members.map((m) => ({
        itemId: m.itemId,
        source: m.source,
        time: m.time.toISOString(),
        excerpt: m.text.slice(0, 200),
      })),
      rank: idx,
    };
  });

  return {
    signal: 'cross-platform',
    score,
    confidence: 1,
    evidence,
    metrics: {
      multiPlatformClusters: multi.length,
      totalClusters: clusters.length,
    },
    computeMs: Date.now() - t0,
  };
}
```

- [ ] **Step 10.4: 테스트 통과 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- cross-platform.test`
Expected: PASS

- [ ] **Step 10.5: 커밋**

```bash
git add packages/core/src/analysis/manipulation/signals/cross-platform.ts \
  packages/core/src/analysis/manipulation/__tests__/cross-platform.test.ts
git commit -m "feat(core): S7 cross-platform (S3 클러스터 후처리)"
```

---

## Task 11: S5 Media Sync

**Files:**

- Create: `packages/core/src/analysis/manipulation/signals/media-sync.ts`
- Test: `packages/core/src/analysis/manipulation/__tests__/media-sync.test.ts`

- [ ] **Step 11.1: 실패 테스트 작성**

`packages/core/src/analysis/manipulation/__tests__/media-sync.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeMediaSync } from '../signals/media-sync';
import type { ArticleEmbedded } from '../signals/media-sync';

function art(
  id: string,
  publisher: string,
  headline: string,
  emb: number[],
  isoTime: string,
): ArticleEmbedded {
  return {
    itemId: id,
    publisher,
    headline,
    embedding: emb,
    time: new Date(isoTime),
  };
}

describe('media-sync signal', () => {
  it('동일 publisher 묶음은 점수 안 줌', () => {
    const items = [
      art('1', 'P1', 'H', [1, 0], '2026-04-27T10:00:00Z'),
      art('2', 'P1', 'H', [1, 0], '2026-04-27T10:05:00Z'),
    ];
    const result = computeMediaSync(items);
    expect(result.score).toBe(0);
  });

  it('30분 윈도우 내 3개 매체 동조화 = 65점 이상', () => {
    const items = [
      art('1', 'P1', '동일 헤드라인', [0.9, 0.1], '2026-04-27T10:00:00Z'),
      art('2', 'P2', '동일 헤드라인', [0.9, 0.1], '2026-04-27T10:10:00Z'),
      art('3', 'P3', '동일 헤드라인', [0.9, 0.1], '2026-04-27T10:20:00Z'),
    ];
    const result = computeMediaSync(items);
    expect(result.score).toBeGreaterThanOrEqual(65);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it('빈 입력 confidence 0', () => {
    const result = computeMediaSync([]);
    expect(result.confidence).toBe(0);
  });
});
```

- [ ] **Step 11.2: 테스트 실패 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- media-sync.test`
Expected: FAIL

- [ ] **Step 11.3: 구현 작성**

`packages/core/src/analysis/manipulation/signals/media-sync.ts`:

```typescript
import { clamp } from '../utils/stats';
import { cosineSimilarity } from './similarity';
import type { SignalResult, EvidenceCard } from '../types';

const WINDOW_MS = 30 * 60 * 1000;
const COSINE_MIN = 0.88;

export type ArticleEmbedded = {
  itemId: string;
  publisher: string;
  headline: string;
  embedding: number[];
  time: Date;
};

export function computeMediaSync(items: ArticleEmbedded[]): SignalResult {
  const t0 = Date.now();
  if (items.length === 0) {
    return {
      signal: 'media-sync',
      score: 0,
      confidence: 0,
      evidence: [],
      metrics: { topClusterSize: 0, clusterCount: 0 },
      computeMs: Date.now() - t0,
    };
  }

  const sorted = [...items].sort((a, b) => a.time.getTime() - b.time.getTime());
  const visited = new Set<number>();
  const clusters: { members: ArticleEmbedded[]; publisherSet: Set<string>; spanMs: number }[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (visited.has(i)) continue;
    const cluster: ArticleEmbedded[] = [sorted[i]];
    visited.add(i);
    for (let j = i + 1; j < sorted.length; j++) {
      if (visited.has(j)) continue;
      if (sorted[j].time.getTime() - sorted[i].time.getTime() > WINDOW_MS) break;
      if (cosineSimilarity(sorted[i].embedding, sorted[j].embedding) >= COSINE_MIN) {
        cluster.push(sorted[j]);
        visited.add(j);
      }
    }
    const publisherSet = new Set(cluster.map((c) => c.publisher));
    if (publisherSet.size >= 2) {
      const times = cluster.map((c) => c.time.getTime());
      clusters.push({
        members: cluster,
        publisherSet,
        spanMs: Math.max(...times) - Math.min(...times),
      });
    }
  }

  const topCluster = clusters.sort((a, b) => b.publisherSet.size - a.publisherSet.size)[0];
  const topSize = topCluster?.publisherSet.size ?? 0;
  const speedFactor = topCluster ? 1 - topCluster.spanMs / WINDOW_MS : 0;

  let score = 0;
  if (topSize >= 3) score = clamp(65 + (topSize - 3) * 8 + speedFactor * 15, 0, 100);
  else if (topSize === 2) score = clamp(35 + speedFactor * 20, 0, 60);

  const evidence: EvidenceCard[] = [];
  if (topCluster && topSize >= 2) {
    evidence.push({
      signal: 'media-sync',
      severity: topSize >= 4 ? 'high' : topSize >= 3 ? 'medium' : 'low',
      title: `${topSize}개 매체 동시 동조화 (${Math.round(topCluster.spanMs / 60000)}분 내)`,
      summary: topCluster.members[0].headline.slice(0, 80),
      visualization: {
        kind: 'media-sync-timeline',
        cluster: topCluster.members[0].headline,
        items: topCluster.members.map((m) => ({
          publisher: m.publisher,
          time: m.time.toISOString(),
          headline: m.headline,
        })),
      },
      rawRefs: topCluster.members.map((m) => ({
        itemId: m.itemId,
        source: m.publisher,
        time: m.time.toISOString(),
        excerpt: m.headline,
      })),
      rank: 0,
    });
  }

  return {
    signal: 'media-sync',
    score,
    confidence: Math.min(1, items.length / 50),
    evidence,
    metrics: { topClusterSize: topSize, clusterCount: clusters.length, sampleCount: items.length },
    computeMs: Date.now() - t0,
  };
}
```

- [ ] **Step 11.4: 테스트 통과 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- media-sync.test`
Expected: PASS

- [ ] **Step 11.5: 커밋**

```bash
git add packages/core/src/analysis/manipulation/signals/media-sync.ts \
  packages/core/src/analysis/manipulation/__tests__/media-sync.test.ts
git commit -m "feat(core): S5 media sync (30분 윈도우 + cosine)"
```

---

## Task 12: Aggregator

**Files:**

- Create: `packages/core/src/analysis/manipulation/aggregator.ts`
- Test: `packages/core/src/analysis/manipulation/__tests__/aggregator.test.ts`

- [ ] **Step 12.1: 실패 테스트 작성**

`packages/core/src/analysis/manipulation/__tests__/aggregator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { aggregate } from '../aggregator';
import type { SignalResult, DomainConfig } from '../types';

const config: DomainConfig = {
  domain: 'political',
  weights: {
    burst: 0.18,
    similarity: 0.22,
    vote: 0.14,
    'media-sync': 0.16,
    'trend-shape': 0.1,
    'cross-platform': 0.12,
    temporal: 0.08,
  },
  thresholds: {
    burst: { medium: 50, high: 70 },
    similarity: { medium: 50, high: 70 },
    vote: { medium: 50, high: 70 },
    'media-sync': { medium: 50, high: 65 },
    'trend-shape': { medium: 50, high: 70 },
    'cross-platform': { medium: 50, high: 70 },
    temporal: { medium: 50, high: 70 },
  },
  baselineDays: 30,
  narrativeContext: 'test',
};

function r(signal: SignalResult['signal'], score: number, confidence = 1): SignalResult {
  return { signal, score, confidence, evidence: [], metrics: {}, computeMs: 0 };
}

describe('aggregator', () => {
  it('모든 신호 0 → score 0', () => {
    const out = aggregate(
      [
        r('burst', 0),
        r('similarity', 0),
        r('vote', 0),
        r('media-sync', 0),
        r('trend-shape', 0),
        r('cross-platform', 0),
        r('temporal', 0),
      ],
      config,
    );
    expect(out.manipulationScore).toBe(0);
    expect(out.confidenceFactor).toBe(1);
  });

  it('모든 신호 100 + confidence 1 → score 100', () => {
    const out = aggregate(
      [
        r('burst', 100),
        r('similarity', 100),
        r('vote', 100),
        r('media-sync', 100),
        r('trend-shape', 100),
        r('cross-platform', 100),
        r('temporal', 100),
      ],
      config,
    );
    expect(out.manipulationScore).toBeCloseTo(100, 1);
  });

  it('가중 평균 계산 검증', () => {
    // similarity만 100, 나머지 0 → 100 * 0.22 = 22
    const out = aggregate(
      [
        r('burst', 0),
        r('similarity', 100),
        r('vote', 0),
        r('media-sync', 0),
        r('trend-shape', 0),
        r('cross-platform', 0),
        r('temporal', 0),
      ],
      config,
    );
    expect(out.manipulationScore).toBeCloseTo(22, 0);
  });

  it('confidence 낮으면 score 하향', () => {
    const out = aggregate(
      [
        r('burst', 100, 0.5),
        r('similarity', 100, 0.5),
        r('vote', 100, 0.5),
        r('media-sync', 100, 0.5),
        r('trend-shape', 100, 0.5),
        r('cross-platform', 100, 0.5),
        r('temporal', 100, 0.5),
      ],
      config,
    );
    expect(out.confidenceFactor).toBeCloseTo(0.5, 5);
    expect(out.manipulationScore).toBeCloseTo(50, 1);
  });

  it('signalScores 맵 정확도', () => {
    const out = aggregate(
      [
        r('burst', 50),
        r('similarity', 60),
        r('vote', 70),
        r('media-sync', 80),
        r('trend-shape', 90),
        r('cross-platform', 100),
        r('temporal', 10),
      ],
      config,
    );
    expect(out.signalScores.burst).toBe(50);
    expect(out.signalScores.similarity).toBe(60);
    expect(out.signalScores['cross-platform']).toBe(100);
  });

  it('가중치 누락 신호 검출', () => {
    const badConfig = { ...config, weights: { ...config.weights, burst: undefined as any } };
    expect(() =>
      aggregate(
        [
          r('burst', 50),
          r('similarity', 0),
          r('vote', 0),
          r('media-sync', 0),
          r('trend-shape', 0),
          r('cross-platform', 0),
          r('temporal', 0),
        ],
        badConfig,
      ),
    ).toThrow(/burst/);
  });
});
```

- [ ] **Step 12.2: 테스트 실패 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- aggregator.test`
Expected: FAIL

- [ ] **Step 12.3: 구현 작성**

`packages/core/src/analysis/manipulation/aggregator.ts`:

```typescript
import { clamp } from './utils/stats';
import { SIGNAL_TYPES } from '../../db/schema/manipulation';
import type { SignalResult, SignalType, DomainConfig } from './types';

export type AggregateResult = {
  manipulationScore: number;
  confidenceFactor: number;
  signalScores: Record<SignalType, number>;
};

export function aggregate(signals: SignalResult[], config: DomainConfig): AggregateResult {
  for (const t of SIGNAL_TYPES) {
    if (typeof config.weights[t] !== 'number') {
      throw new Error(`aggregate: 가중치 누락 신호 ${t}`);
    }
  }

  const byType = new Map<SignalType, SignalResult>();
  for (const s of signals) byType.set(s.signal, s);

  let weighted = 0;
  let confSum = 0;
  let confN = 0;
  const signalScores: Record<SignalType, number> = {} as Record<SignalType, number>;

  for (const t of SIGNAL_TYPES) {
    const r = byType.get(t);
    const score = r?.score ?? 0;
    const conf = r?.confidence ?? 0;
    signalScores[t] = score;
    weighted += score * config.weights[t];
    confSum += conf;
    confN += 1;
  }

  const confidenceFactor = confN === 0 ? 0 : confSum / confN;
  const manipulationScore = clamp(weighted * confidenceFactor, 0, 100);

  return {
    manipulationScore,
    confidenceFactor,
    signalScores,
  };
}
```

- [ ] **Step 12.4: 테스트 통과 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- aggregator.test`
Expected: PASS (6 tests)

- [ ] **Step 12.5: 커밋**

```bash
git add packages/core/src/analysis/manipulation/aggregator.ts \
  packages/core/src/analysis/manipulation/__tests__/aggregator.test.ts
git commit -m "feat(core): manipulation aggregator (가중평균 + confidence factor)"
```

---

## Task 13: Runner — 데이터 로딩 + 7개 신호 실행 + DB 저장

**Files:**

- Create: `packages/core/src/analysis/manipulation/runner.ts`
- Create: `packages/core/src/analysis/manipulation/index.ts`
- Test: `packages/core/src/analysis/manipulation/__tests__/runner.test.ts`

이 task는 결정론 신호들의 통합·DB 저장을 담당합니다. raw_items는 timescaledb(다른 DB)에 있으므로, runner는 **데이터 로더 인터페이스를 받는 형태**로 설계합니다 (테스트 가능성 확보 + Phase 2의 orchestrator 연결 단순화).

- [ ] **Step 13.1: 실패 테스트 작성**

`packages/core/src/analysis/manipulation/__tests__/runner.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { runManipulationDetection } from '../runner';
import type { ManipulationDataLoader, DomainConfig } from '../types';
import type { CommentRow } from '../signals/burst';

const config: DomainConfig = {
  domain: 'political',
  weights: {
    burst: 0.18,
    similarity: 0.22,
    vote: 0.14,
    'media-sync': 0.16,
    'trend-shape': 0.1,
    'cross-platform': 0.12,
    temporal: 0.08,
  },
  thresholds: {
    burst: { medium: 50, high: 70 },
    similarity: { medium: 50, high: 70 },
    vote: { medium: 50, high: 70 },
    'media-sync': { medium: 50, high: 65 },
    'trend-shape': { medium: 50, high: 70 },
    'cross-platform': { medium: 50, high: 70 },
    temporal: { medium: 50, high: 70 },
  },
  baselineDays: 30,
  narrativeContext: 'test',
};

function emptyLoader(): ManipulationDataLoader {
  return {
    loadComments: async () => [],
    loadVotes: async () => [],
    loadEmbeddedComments: async () => [],
    loadEmbeddedArticles: async () => [],
    loadTrendSeries: async () => [],
    loadTemporalBaselines: async () => ({}),
  };
}

describe('runManipulationDetection', () => {
  it('빈 데이터에서도 7개 신호 모두 0점 반환', async () => {
    const result = await runManipulationDetection({
      jobId: 1,
      subscriptionId: null,
      domain: 'political',
      config,
      dateRange: {
        start: new Date('2026-04-01'),
        end: new Date('2026-04-27'),
      },
      loader: emptyLoader(),
    });
    expect(result.signals).toHaveLength(7);
    expect(result.aggregate.manipulationScore).toBe(0);
    expect(result.aggregate.confidenceFactor).toBe(0);
  });

  it('signal 결과는 7개 모두 포함', async () => {
    const result = await runManipulationDetection({
      jobId: 1,
      subscriptionId: null,
      domain: 'political',
      config,
      dateRange: {
        start: new Date('2026-04-01'),
        end: new Date('2026-04-27'),
      },
      loader: emptyLoader(),
    });
    const types = result.signals.map((s) => s.signal).sort();
    expect(types).toEqual([
      'burst',
      'cross-platform',
      'media-sync',
      'similarity',
      'temporal',
      'trend-shape',
      'vote',
    ]);
  });

  it('burst 신호가 데이터 받으면 점수 산출', async () => {
    const burstComments: CommentRow[] = [];
    for (let i = 0; i < 12; i++) {
      const min = String(i * 5).padStart(2, '0');
      burstComments.push({
        itemId: `c${i}`,
        parentSourceId: 'p1',
        source: 'dcinside',
        time: new Date(`2026-04-27T08:${min}:00Z`),
        excerpt: '',
      });
    }
    for (let i = 0; i < 30; i++) {
      const sec = String(i * 2).padStart(2, '0');
      burstComments.push({
        itemId: `b${i}`,
        parentSourceId: 'p1',
        source: 'dcinside',
        time: new Date(`2026-04-27T10:00:${sec}Z`),
        excerpt: '',
      });
    }

    const loader: ManipulationDataLoader = {
      ...emptyLoader(),
      loadComments: async () => burstComments,
    };

    const result = await runManipulationDetection({
      jobId: 1,
      subscriptionId: null,
      domain: 'political',
      config,
      dateRange: {
        start: new Date('2026-04-27T00:00:00Z'),
        end: new Date('2026-04-27T23:59:59Z'),
      },
      loader,
    });
    const burst = result.signals.find((s) => s.signal === 'burst')!;
    expect(burst.score).toBeGreaterThanOrEqual(70);
  });
});
```

- [ ] **Step 13.2: 테스트 실패 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- runner.test`
Expected: FAIL — runner 모듈 없음

- [ ] **Step 13.3: types.ts에 ManipulationDataLoader 추가**

`packages/core/src/analysis/manipulation/types.ts` 끝에 추가:

```typescript
import type { CommentRow } from './signals/burst';
import type { VoteRow } from './signals/vote';
import type { EmbeddedItem } from './signals/similarity';
import type { ArticleEmbedded } from './signals/media-sync';
import type { TrendPoint } from './signals/trend-shape';

export type ManipulationDataLoader = {
  loadComments(ctx: SignalContext): Promise<CommentRow[]>;
  loadVotes(ctx: SignalContext): Promise<VoteRow[]>;
  loadEmbeddedComments(ctx: SignalContext): Promise<EmbeddedItem[]>;
  loadEmbeddedArticles(ctx: SignalContext): Promise<ArticleEmbedded[]>;
  loadTrendSeries(ctx: SignalContext): Promise<TrendPoint[]>;
  loadTemporalBaselines(ctx: SignalContext): Promise<Record<string, number[]>>;
};
```

- [ ] **Step 13.4: runner.ts 작성**

`packages/core/src/analysis/manipulation/runner.ts`:

```typescript
import { computeBurstFromComments } from './signals/burst';
import { computeVoteAnomaly } from './signals/vote';
import { computeSimilarity, extractClustersForCrossPlatform } from './signals/similarity';
import { computeMediaSync } from './signals/media-sync';
import { computeTrendShape } from './signals/trend-shape';
import { computeTemporalAnomaly } from './signals/temporal';
import { computeCrossPlatform } from './signals/cross-platform';
import { aggregate, type AggregateResult } from './aggregator';
import type { SignalResult, SignalContext, ManipulationDataLoader, DomainConfig } from './types';

export type RunInput = {
  jobId: number;
  subscriptionId: number | null;
  domain: string;
  config: DomainConfig;
  dateRange: { start: Date; end: Date };
  loader: ManipulationDataLoader;
};

export type RunOutput = {
  signals: SignalResult[];
  aggregate: AggregateResult;
};

export async function runManipulationDetection(input: RunInput): Promise<RunOutput> {
  const ctx: SignalContext = {
    jobId: input.jobId,
    subscriptionId: input.subscriptionId,
    domain: input.domain,
    config: input.config,
    dateRange: input.dateRange,
  };

  const [comments, votes, embComments, embArticles, trendSeries, baselines] = await Promise.all([
    input.loader.loadComments(ctx),
    input.loader.loadVotes(ctx),
    input.loader.loadEmbeddedComments(ctx),
    input.loader.loadEmbeddedArticles(ctx),
    input.loader.loadTrendSeries(ctx),
    input.loader.loadTemporalBaselines(ctx),
  ]);

  // 통계·임베딩 신호 병렬 (모두 결정론적)
  const burst = computeBurstFromComments(comments);
  const vote = computeVoteAnomaly(votes);
  const simResult = computeSimilarity(embComments);
  const mediaSync = computeMediaSync(embArticles);
  const trend = computeTrendShape(trendSeries);
  const temporal = computeTemporalAnomaly(comments, baselines);

  // S7는 S3 클러스터 후처리 — 같은 임베딩 셋을 다시 클러스터링
  const clusters = extractClustersForCrossPlatform(embComments);
  const crossPlatform = computeCrossPlatform(clusters);

  const signals: SignalResult[] = [
    burst,
    simResult,
    vote,
    mediaSync,
    trend,
    crossPlatform,
    temporal,
  ];
  const aggregateResult = aggregate(signals, input.config);

  return { signals, aggregate: aggregateResult };
}
```

- [ ] **Step 13.5: index.ts (public API) 작성**

`packages/core/src/analysis/manipulation/index.ts`:

```typescript
export { runManipulationDetection } from './runner';
export { aggregate } from './aggregator';
export * from './types';
```

- [ ] **Step 13.6: 테스트 통과 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- runner.test`
Expected: PASS (3 tests)

- [ ] **Step 13.7: 전체 테스트 실행**

Run: `pnpm --filter @ai-signalcraft/core test -- manipulation`
Expected: 모든 manipulation 테스트 PASS, 기존 테스트 영향 없음

- [ ] **Step 13.8: 커밋**

```bash
git add packages/core/src/analysis/manipulation/runner.ts \
  packages/core/src/analysis/manipulation/index.ts \
  packages/core/src/analysis/manipulation/types.ts \
  packages/core/src/analysis/manipulation/__tests__/runner.test.ts
git commit -m "feat(core): manipulation runner (7개 신호 통합 + Aggregator)"
```

---

## Task 14: 결과 영속화 (DB 저장 함수)

**Files:**

- Create: `packages/core/src/analysis/manipulation/persist.ts`
- Test: `packages/core/src/analysis/manipulation/__tests__/persist.test.ts`

저장은 별 함수로 분리 — runner는 순수 계산, persist는 DB 쓰기만.

- [ ] **Step 14.1: 실패 테스트 작성**

`packages/core/src/analysis/manipulation/__tests__/persist.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { persistRun } from '../persist';
import type { RunOutput } from '../runner';

describe('persistRun', () => {
  it('runs/signals/evidence 모두 INSERT 호출', async () => {
    const inserts: { table: string; values: unknown }[] = [];
    const fakeDb = {
      insert: (table: { _: { name: string } }) => ({
        values: async (values: unknown) => {
          inserts.push({ table: table._.name, values });
          if (table._.name === 'manipulation_runs') {
            return [{ id: 'run-uuid-1' }];
          }
          return [];
        },
        returning: () => ({
          execute: async () => [{ id: 'run-uuid-1' }],
        }),
      }),
    } as any;

    const out: RunOutput = {
      signals: [
        {
          signal: 'burst',
          score: 50,
          confidence: 0.8,
          evidence: [
            {
              signal: 'burst',
              severity: 'medium',
              title: 'T',
              summary: 'S',
              visualization: { kind: 'burst-heatmap', buckets: [] },
              rawRefs: [],
              rank: 0,
            },
          ],
          metrics: { maxZ: 4 },
          computeMs: 10,
        },
      ],
      aggregate: {
        manipulationScore: 50,
        confidenceFactor: 0.8,
        signalScores: {
          burst: 50,
          similarity: 0,
          vote: 0,
          'media-sync': 0,
          'trend-shape': 0,
          'cross-platform': 0,
          temporal: 0,
        },
      },
    };

    const runId = await persistRun(fakeDb, {
      jobId: 1,
      subscriptionId: null,
      output: out,
      weightsVersion: 'v1-political',
    });

    expect(runId).toBe('run-uuid-1');
    const tables = inserts.map((i) => i.table);
    expect(tables).toContain('manipulation_runs');
    expect(tables).toContain('manipulation_signals');
    expect(tables).toContain('manipulation_evidence');
  });
});
```

- [ ] **Step 14.2: 테스트 실패 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- persist.test`
Expected: FAIL

- [ ] **Step 14.3: 구현 작성**

`packages/core/src/analysis/manipulation/persist.ts`:

```typescript
import { eq } from 'drizzle-orm';
import {
  manipulationRuns,
  manipulationSignals,
  manipulationEvidence,
} from '../../db/schema/manipulation';
import type { RunOutput } from './runner';

export type PersistInput = {
  jobId: number;
  subscriptionId: number | null;
  output: RunOutput;
  weightsVersion: string;
};

// db는 drizzle 인스턴스 (타입은 caller가 전달, 테스트에서 모의 가능)
export async function persistRun(db: any, input: PersistInput): Promise<string> {
  const inserted = await db
    .insert(manipulationRuns)
    .values({
      jobId: input.jobId,
      subscriptionId: input.subscriptionId,
      status: 'completed',
      manipulationScore: input.output.aggregate.manipulationScore,
      confidenceFactor: input.output.aggregate.confidenceFactor,
      weightsVersion: input.weightsVersion,
      signalScores: input.output.aggregate.signalScores,
      completedAt: new Date(),
    })
    .returning({ id: manipulationRuns.id })
    .execute();
  const runId: string = inserted[0].id;

  // signals 배치 INSERT
  if (input.output.signals.length > 0) {
    await db.insert(manipulationSignals).values(
      input.output.signals.map((s) => ({
        runId,
        signal: s.signal,
        score: s.score,
        confidence: s.confidence,
        metrics: s.metrics,
        computeMs: s.computeMs,
      })),
    );
  }

  // evidence 배치 INSERT
  const allEvidence = input.output.signals.flatMap((s) =>
    s.evidence.map((e) => ({
      runId,
      signal: e.signal,
      severity: e.severity,
      title: e.title,
      summary: e.summary,
      visualization: e.visualization,
      rawRefs: e.rawRefs,
      rank: e.rank,
    })),
  );
  if (allEvidence.length > 0) {
    await db.insert(manipulationEvidence).values(allEvidence);
  }

  return runId;
}

export async function markRunFailed(
  db: any,
  runId: string,
  error: { message: string; stack?: string },
): Promise<void> {
  await db
    .update(manipulationRuns)
    .set({
      status: 'failed',
      completedAt: new Date(),
      errorDetails: error,
    })
    .where(eq(manipulationRuns.id, runId));
}
```

- [ ] **Step 14.4: 테스트 통과 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- persist.test`
Expected: PASS

- [ ] **Step 14.5: index.ts에 persist export 추가**

`packages/core/src/analysis/manipulation/index.ts`:

```typescript
export { runManipulationDetection } from './runner';
export { aggregate } from './aggregator';
export { persistRun, markRunFailed } from './persist';
export * from './types';
```

- [ ] **Step 14.6: 커밋**

```bash
git add packages/core/src/analysis/manipulation/persist.ts \
  packages/core/src/analysis/manipulation/__tests__/persist.test.ts \
  packages/core/src/analysis/manipulation/index.ts
git commit -m "feat(core): manipulation persist (runs/signals/evidence INSERT)"
```

---

## Task 15: 내부 dryrun CLI

**Files:**

- Create: `packages/core/scripts/manipulation-dryrun.ts`
- Modify: `packages/core/package.json`

이 CLI는 외부 노출 없이 운영자가 jobId 하나로 manipulation_runs를 즉시 실행해보는 용도. Phase 2에서 orchestrator 통합 전 검증용.

데이터 로더 구현체는 raw_items가 있는 timescaledb 접근이 필요한데, 본 Phase에서는 **stub 로더로 모든 신호를 0점으로 실행**해서 DB write path가 깨지지 않는지만 검증합니다. 실제 timescaledb 연결 로더는 Phase 2에서 추가.

- [ ] **Step 15.1: dryrun 스크립트 작성**

`packages/core/scripts/manipulation-dryrun.ts`:

```typescript
import 'dotenv/config';
import { db } from '../src/db/index';
import { manipulationDomainConfigs } from '../src/db/schema/manipulation';
import { eq } from 'drizzle-orm';
import {
  runManipulationDetection,
  persistRun,
  type ManipulationDataLoader,
  type DomainConfig,
} from '../src/analysis/manipulation';

async function main() {
  const jobIdArg = process.argv[2];
  const domainArg = process.argv[3] ?? 'political';
  if (!jobIdArg) {
    console.error('사용법: tsx scripts/manipulation-dryrun.ts <jobId> [domain]');
    process.exit(2);
  }
  const jobId = Number(jobIdArg);
  if (!Number.isInteger(jobId)) {
    console.error(`jobId는 정수여야 합니다: ${jobIdArg}`);
    process.exit(2);
  }

  const cfgRows = await db
    .select()
    .from(manipulationDomainConfigs)
    .where(eq(manipulationDomainConfigs.domain, domainArg));
  if (cfgRows.length === 0) {
    console.error(`도메인 설정 없음: ${domainArg}. 먼저 db:seed-manipulation 실행`);
    process.exit(2);
  }
  const config: DomainConfig = {
    domain: cfgRows[0].domain,
    weights: cfgRows[0].weights,
    thresholds: cfgRows[0].thresholds,
    baselineDays: cfgRows[0].baselineDays,
    narrativeContext: cfgRows[0].narrativeContext,
  };

  // Phase 1: stub 로더 — 모든 데이터 빈 배열
  const loader: ManipulationDataLoader = {
    loadComments: async () => [],
    loadVotes: async () => [],
    loadEmbeddedComments: async () => [],
    loadEmbeddedArticles: async () => [],
    loadTrendSeries: async () => [],
    loadTemporalBaselines: async () => ({}),
  };

  const t0 = Date.now();
  const out = await runManipulationDetection({
    jobId,
    subscriptionId: null,
    domain: domainArg,
    config,
    dateRange: {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: new Date(),
    },
    loader,
  });

  const runId = await persistRun(db, {
    jobId,
    subscriptionId: null,
    output: out,
    weightsVersion: 'v1-political',
  });

  const elapsed = Date.now() - t0;
  console.log(
    JSON.stringify(
      {
        runId,
        jobId,
        elapsedMs: elapsed,
        manipulationScore: out.aggregate.manipulationScore,
        confidenceFactor: out.aggregate.confidenceFactor,
        signalScores: out.aggregate.signalScores,
        signalCount: out.signals.length,
        evidenceCount: out.signals.reduce((n, s) => n + s.evidence.length, 0),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('[manipulation-dryrun] 실패:', err);
  process.exit(1);
});
```

- [ ] **Step 15.2: package.json scripts에 추가**

`packages/core/package.json`의 scripts에 추가:

```json
"manipulation:dryrun": "tsx scripts/manipulation-dryrun.ts"
```

- [ ] **Step 15.3: 기존 collection_jobs ID 확인**

Run:

```bash
PGPASSWORD=$(grep AIS_DB_PASSWORD /home/gon/projects/ai/ai-signalcraft/.env | cut -d= -f2) \
  psql -h 192.168.0.5 -p 5438 -U ais_app -d ai_signalcraft \
  -c "SELECT id, keyword FROM collection_jobs ORDER BY id DESC LIMIT 1;"
```

Expected: 1행 출력. 그 id를 사용

- [ ] **Step 15.4: dryrun 실행**

Run: `pnpm --filter @ai-signalcraft/core manipulation:dryrun <jobId>` (Step 15.3에서 얻은 jobId)
Expected: JSON 출력 — manipulationScore=0, signalCount=7, evidenceCount=0

- [ ] **Step 15.5: DB에 row 생성 확인**

Run:

```bash
PGPASSWORD=$(grep AIS_DB_PASSWORD /home/gon/projects/ai/ai-signalcraft/.env | cut -d= -f2) \
  psql -h 192.168.0.5 -p 5438 -U ais_app -d ai_signalcraft \
  -c "SELECT id, status, manipulation_score FROM manipulation_runs ORDER BY started_at DESC LIMIT 1;"
```

Expected: 1행, status=completed, manipulation_score=0

Run:

```bash
PGPASSWORD=$(grep AIS_DB_PASSWORD /home/gon/projects/ai/ai-signalcraft/.env | cut -d= -f2) \
  psql -h 192.168.0.5 -p 5438 -U ais_app -d ai_signalcraft \
  -c "SELECT signal, score FROM manipulation_signals WHERE run_id=(SELECT id FROM manipulation_runs ORDER BY started_at DESC LIMIT 1) ORDER BY signal;"
```

Expected: 7행 (burst, cross-platform, media-sync, similarity, temporal, trend-shape, vote)

- [ ] **Step 15.6: CASCADE 삭제 검증**

Run:

```bash
PGPASSWORD=$(grep AIS_DB_PASSWORD /home/gon/projects/ai/ai-signalcraft/.env | cut -d= -f2) \
  psql -h 192.168.0.5 -p 5438 -U ais_app -d ai_signalcraft -c "
DELETE FROM manipulation_runs WHERE id=(SELECT id FROM manipulation_runs ORDER BY started_at DESC LIMIT 1);
SELECT count(*) FROM manipulation_signals;
SELECT count(*) FROM manipulation_evidence;"
```

Expected: 두 count 모두 0

- [ ] **Step 15.7: 커밋**

```bash
git add packages/core/scripts/manipulation-dryrun.ts packages/core/package.json
git commit -m "feat(core): manipulation dryrun CLI (외부 노출 없이 검증)"
```

---

## Task 16: 전체 회귀 검증 + Phase 1 종료

**Files:**

- (수정 없음, 검증만)

- [ ] **Step 16.1: 전체 테스트 실행**

Run: `pnpm --filter @ai-signalcraft/core test`
Expected: 모든 기존 테스트 + 새 manipulation 테스트 PASS. 0 failure

- [ ] **Step 16.2: 빌드 검증**

Run: `pnpm --filter @ai-signalcraft/core build`
Expected: 컴파일 성공

- [ ] **Step 16.3: 린트 검증**

Run: `pnpm --filter @ai-signalcraft/core lint || true; pnpm format --check packages/core/src/analysis/manipulation || true`
Expected: 신규 파일에 lint/format 에러 없음

- [ ] **Step 16.4: 기존 분석 파이프라인 회귀 확인**

Run: `pnpm --filter @ai-signalcraft/core test -- analysis`
Expected: 기존 분석 테스트 모두 PASS (manipulation은 pipeline-orchestrator 미연결이므로 영향 없어야 함)

- [ ] **Step 16.5: 변경 파일 목록 확인**

Run: `git log --oneline main..HEAD`
Expected: Task 0~15에 해당하는 16개 커밋 확인

- [ ] **Step 16.6: Phase 1 종료 commit 메시지 작성 (PR description용)**

이 plan의 결과는 다음을 만족해야 한다 (수동 체크):

- [x] DB 4개 테이블 + 인덱스 생성됨
- [x] political 도메인 시드 1행 INSERT됨
- [x] 7개 신호 모두 단위 테스트 PASS
- [x] Aggregator 단위 테스트 PASS
- [x] runner.ts가 in-memory loader로 PASS
- [x] dryrun CLI로 빈 데이터 + DB 저장 verified
- [x] CASCADE 삭제 정상
- [x] 외부 노출(orchestrator/UI) 없음 — Phase 2 작업

다음 단계: Phase 2 — pipeline-orchestrator Stage 5 통합 + 실제 timescaledb 데이터 로더 + LLM Narrative 모듈 + collection_jobs.options 토글. 별도 plan으로 작성.

---

## Self-Review 결과

**1. Spec coverage:**

- DB 스키마 4개 테이블 → Task 0 ✓
- 도메인 시드 → Task 1 ✓
- 7개 신호 (S1, S3, S4, S5, S6, S7, S8) → Task 5, 9, 8, 11, 7, 10, 6 ✓
- Aggregator → Task 12 ✓
- Runner → Task 13 ✓
- Persist → Task 14 ✓
- 단위 테스트 (Tier 1) → 모든 신호 task에 포함 ✓
- 내부 dryrun CLI → Task 15 ✓
- Phase 2 통합·UI는 본 plan 범위 외 명시 ✓

**2. Placeholder 스캔:** 없음

**3. 타입 일관성:**

- `CommentRow`: burst.ts에 정의, temporal·runner에서 동일 사용 ✓
- `SignalResult`/`EvidenceCard`: types.ts에 정의 ✓
- `SimilarityCluster`: similarity.ts에 정의, cross-platform에서 동일 import ✓
- `EmbeddedItem`/`ArticleEmbedded`: 각 신호 파일에 정의 ✓
- 가중치 키 일관성: SIGNAL_TYPES 상수 사용 (manipulation.ts → aggregator) ✓

이슈 없음.
