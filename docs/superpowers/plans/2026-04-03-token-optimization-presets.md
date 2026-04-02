# Token Optimization Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 분석 실행 전 전처리 파이프라인(중복 제거/클러스터링/댓글 압축)을 4단계 프리셋으로 제어하는 UI와 백엔드 구현

**Architecture:** 기존 `loadAnalysisInput()` → Stage 1 사이에 전처리 레이어 삽입. UI에서 프리셋 선택 → tRPC → DB options jsonb → pipeline-orchestrator가 읽어서 전처리 실행. `@xenova/transformers`(이미 설치됨)로 로컬 임베딩 기반 중복 제거, 그리디 클러스터링, 댓글 상한 적용.

**Tech Stack:** TypeScript, @xenova/transformers (로컬 임베딩), React, shadcn/ui, tRPC, Drizzle ORM, BullMQ

**Spec:** `docs/superpowers/specs/2026-04-03-token-optimization-presets-design.md`

---

## File Structure

### New Files

| File                                                                            | Responsibility                           |
| ------------------------------------------------------------------------------- | ---------------------------------------- |
| `packages/core/src/analysis/preprocessing/index.ts`                             | Public API — `preprocessAnalysisInput()` |
| `packages/core/src/analysis/preprocessing/presets.ts`                           | 프리셋 상수 정의 (임계값, 댓글 상한 등)  |
| `packages/core/src/analysis/preprocessing/embeddings.ts`                        | @xenova/transformers 임베딩 래퍼         |
| `packages/core/src/analysis/preprocessing/deduplicator.ts`                      | 코사인 유사도 기반 중복 제거             |
| `packages/core/src/analysis/preprocessing/clusterer.ts`                         | 그리디 클러스터링 (강력 모드)            |
| `packages/core/src/analysis/preprocessing/comment-compressor.ts`                | 댓글 상한 적용                           |
| `packages/core/src/analysis/preprocessing/__tests__/presets.test.ts`            | 프리셋 상수 테스트                       |
| `packages/core/src/analysis/preprocessing/__tests__/deduplicator.test.ts`       | 중복 제거 테스트                         |
| `packages/core/src/analysis/preprocessing/__tests__/comment-compressor.test.ts` | 댓글 압축 테스트                         |
| `packages/core/src/analysis/preprocessing/__tests__/clusterer.test.ts`          | 클러스터링 테스트                        |

### Modified Files

| File                                                                     | Change                                  |
| ------------------------------------------------------------------------ | --------------------------------------- |
| `packages/core/src/db/schema/collections.ts:41-43`                       | options 타입에 `tokenOptimization` 추가 |
| `packages/core/src/analysis/index.ts:1-13`                               | preprocessing export 추가               |
| `packages/core/src/analysis/pipeline-orchestrator.ts:302-350`            | 전처리 호출 삽입                        |
| `apps/web/src/server/trpc/routers/analysis.ts:23-27`                     | input schema에 tokenOptimization 추가   |
| `apps/web/src/components/analysis/trigger-form.tsx:67-165`               | 프리셋 UI 추가                          |
| `apps/web/src/components/analysis/pipeline-monitor/constants.ts:271-277` | PIPELINE_STEPS에 단계 추가              |
| `apps/web/src/components/analysis/pipeline-monitor/stage-flow.tsx:29-35` | 아이콘 매핑 추가                        |
| `apps/web/src/server/pipeline-status.ts:124-182`                         | 전처리 단계 상태 유도 추가              |

---

### Task 1: 프리셋 상수 정의

**Files:**

- Create: `packages/core/src/analysis/preprocessing/presets.ts`
- Create: `packages/core/src/analysis/preprocessing/__tests__/presets.test.ts`

- [ ] **Step 1: 프리셋 테스트 작성**

```typescript
// packages/core/src/analysis/preprocessing/__tests__/presets.test.ts
import { describe, it, expect } from 'vitest';
import { OPTIMIZATION_PRESETS, type OptimizationPreset } from '../presets';

describe('OPTIMIZATION_PRESETS', () => {
  it('4개 프리셋이 정의되어 있어야 한다', () => {
    expect(Object.keys(OPTIMIZATION_PRESETS)).toHaveLength(4);
    expect(OPTIMIZATION_PRESETS).toHaveProperty('none');
    expect(OPTIMIZATION_PRESETS).toHaveProperty('light');
    expect(OPTIMIZATION_PRESETS).toHaveProperty('standard');
    expect(OPTIMIZATION_PRESETS).toHaveProperty('aggressive');
  });

  it('none 프리셋은 모든 최적화가 비활성이다', () => {
    const none = OPTIMIZATION_PRESETS.none;
    expect(none.deduplication).toBe(false);
    expect(none.clustering).toBe(false);
    expect(none.commentLimit).toBeNull();
  });

  it('프리셋 강도가 올라갈수록 유사도 임계값이 낮아진다', () => {
    const light = OPTIMIZATION_PRESETS.light;
    const standard = OPTIMIZATION_PRESETS.standard;
    const aggressive = OPTIMIZATION_PRESETS.aggressive;
    expect(light.similarityThreshold!).toBeGreaterThan(standard.similarityThreshold!);
    expect(standard.similarityThreshold!).toBeGreaterThan(aggressive.similarityThreshold!);
  });

  it('aggressive만 클러스터링이 활성이다', () => {
    expect(OPTIMIZATION_PRESETS.light.clustering).toBe(false);
    expect(OPTIMIZATION_PRESETS.standard.clustering).toBe(false);
    expect(OPTIMIZATION_PRESETS.aggressive.clustering).toBe(true);
  });

  it('댓글 상한이 프리셋 강도에 따라 줄어든다', () => {
    expect(OPTIMIZATION_PRESETS.light.commentLimit!).toBeGreaterThan(
      OPTIMIZATION_PRESETS.standard.commentLimit!,
    );
    expect(OPTIMIZATION_PRESETS.standard.commentLimit!).toBeGreaterThan(
      OPTIMIZATION_PRESETS.aggressive.commentLimit!,
    );
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm vitest run packages/core/src/analysis/preprocessing/__tests__/presets.test.ts`
Expected: FAIL — `Cannot find module '../presets'`

- [ ] **Step 3: 프리셋 상수 구현**

```typescript
// packages/core/src/analysis/preprocessing/presets.ts
export type OptimizationPreset = 'none' | 'light' | 'standard' | 'aggressive';

export interface PresetConfig {
  deduplication: boolean;
  similarityThreshold: number | null; // 코사인 유사도 임계값 (null = 비활성)
  clustering: boolean;
  commentLimit: number | null; // 분석용 댓글 상한 (null = 제한 없음)
  label: string;
  description: string;
  estimatedReduction: string; // UI 표시용
  color: string; // Tailwind 색상 접두사
}

export const OPTIMIZATION_PRESETS: Record<OptimizationPreset, PresetConfig> = {
  none: {
    deduplication: false,
    similarityThreshold: null,
    clustering: false,
    commentLimit: null,
    label: '없음',
    description: '전처리 없이 전체 데이터를 분석합니다.',
    estimatedReduction: '0%',
    color: 'zinc',
  },
  light: {
    deduplication: true,
    similarityThreshold: 0.95,
    clustering: false,
    commentLimit: 200,
    label: '경량',
    description: '거의 동일한 중복 기사를 제거합니다.',
    estimatedReduction: '~30%',
    color: 'green',
  },
  standard: {
    deduplication: true,
    similarityThreshold: 0.9,
    clustering: false,
    commentLimit: 100,
    label: '표준',
    description: '유사 기사 중복 제거 + 분석용 댓글 상위 100건으로 압축합니다.',
    estimatedReduction: '~60%',
    color: 'yellow',
  },
  aggressive: {
    deduplication: true,
    similarityThreshold: 0.85,
    clustering: true,
    commentLimit: 50,
    label: '강력',
    description: '클러스터링으로 대표 기사만 분석, 댓글 상위 50건으로 압축합니다.',
    estimatedReduction: '~80%',
    color: 'orange',
  },
};
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm vitest run packages/core/src/analysis/preprocessing/__tests__/presets.test.ts`
Expected: PASS — 모든 테스트 통과

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/analysis/preprocessing/presets.ts packages/core/src/analysis/preprocessing/__tests__/presets.test.ts
git commit -m "feat: 토큰 최적화 프리셋 상수 정의"
```

---

### Task 2: 댓글 압축 모듈

**Files:**

- Create: `packages/core/src/analysis/preprocessing/comment-compressor.ts`
- Create: `packages/core/src/analysis/preprocessing/__tests__/comment-compressor.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// packages/core/src/analysis/preprocessing/__tests__/comment-compressor.test.ts
import { describe, it, expect } from 'vitest';
import { compressComments } from '../comment-compressor';
import type { AnalysisInput } from '../../types';

function makeComments(count: number): AnalysisInput['comments'] {
  return Array.from({ length: count }, (_, i) => ({
    content: `댓글 내용 ${i}`,
    source: 'naver-news',
    author: `user${i}`,
    likeCount: count - i, // 좋아요순 내림차순
    dislikeCount: 0,
    publishedAt: new Date(),
  }));
}

describe('compressComments', () => {
  it('상한이 null이면 원본 그대로 반환', () => {
    const comments = makeComments(500);
    const result = compressComments(comments, null);
    expect(result).toHaveLength(500);
  });

  it('댓글 수가 상한 이하면 변경 없음', () => {
    const comments = makeComments(50);
    const result = compressComments(comments, 100);
    expect(result).toHaveLength(50);
  });

  it('상한 적용 시 좋아요순 상위만 유지', () => {
    const comments = makeComments(300);
    const result = compressComments(comments, 100);
    expect(result).toHaveLength(100);
    // 첫 번째 댓글이 좋아요가 가장 많아야 함
    expect(result[0].likeCount).toBeGreaterThanOrEqual(result[99].likeCount!);
  });

  it('빈 배열은 빈 배열 반환', () => {
    const result = compressComments([], 100);
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm vitest run packages/core/src/analysis/preprocessing/__tests__/comment-compressor.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

```typescript
// packages/core/src/analysis/preprocessing/comment-compressor.ts
import type { AnalysisInput } from '../types';

export function compressComments(
  comments: AnalysisInput['comments'],
  limit: number | null,
): AnalysisInput['comments'] {
  if (limit === null || comments.length <= limit) return comments;

  // 좋아요순 내림차순 정렬 후 상위 N건
  return [...comments].sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0)).slice(0, limit);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm vitest run packages/core/src/analysis/preprocessing/__tests__/comment-compressor.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/analysis/preprocessing/comment-compressor.ts packages/core/src/analysis/preprocessing/__tests__/comment-compressor.test.ts
git commit -m "feat: 댓글 압축 모듈 구현"
```

---

### Task 3: 임베딩 래퍼

**Files:**

- Create: `packages/core/src/analysis/preprocessing/embeddings.ts`

- [ ] **Step 1: 임베딩 래퍼 구현**

```typescript
// packages/core/src/analysis/preprocessing/embeddings.ts
let pipelineInstance: any = null;

async function getEmbeddingPipeline() {
  if (pipelineInstance) return pipelineInstance;

  const { pipeline } = await import('@xenova/transformers');
  pipelineInstance = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small');
  return pipelineInstance;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const extractor = await getEmbeddingPipeline();
  const results: number[][] = [];

  // 배치 처리 (메모리 절약을 위해 10개씩)
  const batchSize = 10;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    for (const text of batch) {
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      results.push(Array.from(output.data as Float32Array));
    }
  }

  return results;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

- [ ] **Step 2: 커밋**

```bash
git add packages/core/src/analysis/preprocessing/embeddings.ts
git commit -m "feat: @xenova/transformers 임베딩 래퍼 구현"
```

---

### Task 4: 중복 제거 모듈

**Files:**

- Create: `packages/core/src/analysis/preprocessing/deduplicator.ts`
- Create: `packages/core/src/analysis/preprocessing/__tests__/deduplicator.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// packages/core/src/analysis/preprocessing/__tests__/deduplicator.test.ts
import { describe, it, expect, vi } from 'vitest';
import { deduplicateArticles } from '../deduplicator';
import type { AnalysisInput } from '../../types';

// 임베딩을 모킹하여 유사도를 직접 제어
vi.mock('../embeddings', () => ({
  embedTexts: vi.fn(async (texts: string[]) =>
    texts.map((t) => {
      // "동일 이슈 A" 계열은 같은 벡터, "다른 이슈 B"는 다른 벡터
      if (t.includes('이슈A')) return [1, 0, 0];
      if (t.includes('이슈B')) return [0, 1, 0];
      return [0, 0, 1];
    }),
  ),
  cosineSimilarity: vi.fn((a: number[], b: number[]) => {
    let dot = 0,
      nA = 0,
      nB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      nA += a[i] * a[i];
      nB += b[i] * b[i];
    }
    return dot / (Math.sqrt(nA) * Math.sqrt(nB));
  }),
}));

function makeArticle(title: string, content: string, source: string): AnalysisInput['articles'][0] {
  return { title, content, publisher: null, publishedAt: new Date(), source };
}

describe('deduplicateArticles', () => {
  it('중복 기사를 제거하고 대표 기사만 반환', async () => {
    const articles = [
      makeArticle('이슈A 보도1', '이슈A 상세 내용이 아주 긴 기사', 'naver'),
      makeArticle('이슈A 보도2', '이슈A 짧은 기사', 'dcinside'),
      makeArticle('이슈B 보도1', '이슈B 완전히 다른 내용의 기사', 'youtube'),
    ];

    const result = await deduplicateArticles(articles, 0.9);
    // 이슈A 2건 중 더 긴 본문을 가진 기사가 대표로 선정
    expect(result).toHaveLength(2);
    expect(result.find((a) => a.title === '이슈A 보도1')).toBeDefined();
    expect(result.find((a) => a.title === '이슈B 보도1')).toBeDefined();
  });

  it('기사가 1건 이하면 그대로 반환', async () => {
    const articles = [makeArticle('유일한 기사', '이슈C 내용', 'naver')];
    const result = await deduplicateArticles(articles, 0.9);
    expect(result).toHaveLength(1);
  });

  it('빈 배열은 빈 배열 반환', async () => {
    const result = await deduplicateArticles([], 0.9);
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm vitest run packages/core/src/analysis/preprocessing/__tests__/deduplicator.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

```typescript
// packages/core/src/analysis/preprocessing/deduplicator.ts
import type { AnalysisInput } from '../types';
import { embedTexts, cosineSimilarity } from './embeddings';

export async function deduplicateArticles(
  articles: AnalysisInput['articles'],
  similarityThreshold: number,
): Promise<AnalysisInput['articles']> {
  if (articles.length <= 1) return articles;

  // 제목 + 본문 앞부분으로 임베딩 생성
  const texts = articles.map((a) => `${a.title} ${(a.content ?? '').slice(0, 300)}`);
  const embeddings = await embedTexts(texts);

  // 그리디 중복 제거: 이미 대표로 선정된 기사와 비교
  const kept: number[] = [0]; // 첫 번째 기사는 항상 유지

  for (let i = 1; i < articles.length; i++) {
    let isDuplicate = false;
    for (const k of kept) {
      if (cosineSimilarity(embeddings[i], embeddings[k]) >= similarityThreshold) {
        // 중복 발견 — 더 긴 본문을 가진 기사를 대표로 교체
        const currentLen = (articles[k].content ?? '').length;
        const candidateLen = (articles[i].content ?? '').length;
        if (candidateLen > currentLen) {
          kept[kept.indexOf(k)] = i;
        }
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) kept.push(i);
  }

  return kept.map((idx) => articles[idx]);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm vitest run packages/core/src/analysis/preprocessing/__tests__/deduplicator.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/analysis/preprocessing/deduplicator.ts packages/core/src/analysis/preprocessing/__tests__/deduplicator.test.ts
git commit -m "feat: 임베딩 기반 기사 중복 제거 모듈 구현"
```

---

### Task 5: 클러스터링 모듈

**Files:**

- Create: `packages/core/src/analysis/preprocessing/clusterer.ts`
- Create: `packages/core/src/analysis/preprocessing/__tests__/clusterer.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// packages/core/src/analysis/preprocessing/__tests__/clusterer.test.ts
import { describe, it, expect, vi } from 'vitest';
import { clusterArticles } from '../clusterer';
import type { AnalysisInput } from '../../types';

vi.mock('../embeddings', () => ({
  embedTexts: vi.fn(async (texts: string[]) =>
    texts.map((t) => {
      if (t.includes('클러스터1')) return [1, 0, 0];
      if (t.includes('클러스터2')) return [0, 1, 0];
      if (t.includes('클러스터3')) return [0, 0, 1];
      return [0.5, 0.5, 0];
    }),
  ),
  cosineSimilarity: vi.fn((a: number[], b: number[]) => {
    let dot = 0,
      nA = 0,
      nB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      nA += a[i] * a[i];
      nB += b[i] * b[i];
    }
    return dot / (Math.sqrt(nA) * Math.sqrt(nB));
  }),
}));

function makeArticle(title: string, content: string, source: string): AnalysisInput['articles'][0] {
  return { title, content, publisher: null, publishedAt: new Date(), source };
}

describe('clusterArticles', () => {
  it('유사 기사를 클러스터링하고 대표 기사만 반환', async () => {
    const articles = [
      makeArticle('클러스터1 기사A', '클러스터1 내용 아주 길게', 'naver'),
      makeArticle('클러스터1 기사B', '클러스터1 짧게', 'dcinside'),
      makeArticle('클러스터2 기사A', '클러스터2 내용이 긴 기사', 'youtube'),
      makeArticle('클러스터3 기사A', '클러스터3 독립 기사', 'fmkorea'),
    ];

    const result = await clusterArticles(articles, 0.85);
    // 3개 클러스터 → 대표 3건
    expect(result).toHaveLength(3);
  });

  it('기사가 1건이면 그대로 반환', async () => {
    const articles = [makeArticle('유일한 기사', '클러스터1 내용', 'naver')];
    const result = await clusterArticles(articles, 0.85);
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm vitest run packages/core/src/analysis/preprocessing/__tests__/clusterer.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

```typescript
// packages/core/src/analysis/preprocessing/clusterer.ts
import type { AnalysisInput } from '../types';
import { embedTexts, cosineSimilarity } from './embeddings';

export async function clusterArticles(
  articles: AnalysisInput['articles'],
  similarityThreshold: number,
): Promise<AnalysisInput['articles']> {
  if (articles.length <= 1) return articles;

  const texts = articles.map((a) => `${a.title} ${(a.content ?? '').slice(0, 300)}`);
  const embeddings = await embedTexts(texts);

  // 그리디 단일 링크 클러스터링
  const clusterMap = new Map<number, number[]>(); // 대표 인덱스 → 멤버 인덱스들
  const assigned = new Set<number>();

  for (let i = 0; i < articles.length; i++) {
    if (assigned.has(i)) continue;

    const cluster = [i];
    assigned.add(i);

    for (let j = i + 1; j < articles.length; j++) {
      if (assigned.has(j)) continue;
      if (cosineSimilarity(embeddings[i], embeddings[j]) >= similarityThreshold) {
        cluster.push(j);
        assigned.add(j);
      }
    }

    // 클러스터 내 가장 긴 본문을 가진 기사를 대표로
    const representative = cluster.reduce((best, idx) =>
      (articles[idx].content ?? '').length > (articles[best].content ?? '').length ? idx : best,
    );
    clusterMap.set(representative, cluster);
  }

  return Array.from(clusterMap.keys()).map((idx) => articles[idx]);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm vitest run packages/core/src/analysis/preprocessing/__tests__/clusterer.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/analysis/preprocessing/clusterer.ts packages/core/src/analysis/preprocessing/__tests__/clusterer.test.ts
git commit -m "feat: 그리디 클러스터링 모듈 구현"
```

---

### Task 6: 전처리 통합 모듈 (public API)

**Files:**

- Create: `packages/core/src/analysis/preprocessing/index.ts`
- Modify: `packages/core/src/analysis/index.ts:13`

- [ ] **Step 1: 통합 모듈 구현**

```typescript
// packages/core/src/analysis/preprocessing/index.ts
import type { AnalysisInput } from '../types';
import { OPTIMIZATION_PRESETS, type OptimizationPreset } from './presets';
import { deduplicateArticles } from './deduplicator';
import { clusterArticles } from './clusterer';
import { compressComments } from './comment-compressor';

export { OPTIMIZATION_PRESETS, type OptimizationPreset, type PresetConfig } from './presets';
export { compressComments } from './comment-compressor';
export { deduplicateArticles } from './deduplicator';
export { clusterArticles } from './clusterer';

export interface PreprocessingResult {
  input: AnalysisInput;
  stats: {
    originalArticles: number;
    optimizedArticles: number;
    originalComments: number;
    optimizedComments: number;
    reductionPercent: number;
    preset: OptimizationPreset;
  };
}

export async function preprocessAnalysisInput(
  input: AnalysisInput,
  preset: OptimizationPreset,
  jobId: number,
): Promise<PreprocessingResult> {
  const config = OPTIMIZATION_PRESETS[preset];
  const originalArticles = input.articles.length;
  const originalComments = input.comments.length;

  let articles = input.articles;
  let comments = input.comments;

  // 1. 중복 제거
  if (config.deduplication && config.similarityThreshold !== null) {
    try {
      articles = await deduplicateArticles(articles, config.similarityThreshold);
    } catch (error) {
      console.error(`[preprocessing] 중복 제거 실패 (원본 유지):`, error);
    }
  }

  // 2. 클러스터링 (강력 모드)
  if (config.clustering && config.similarityThreshold !== null) {
    try {
      articles = await clusterArticles(articles, config.similarityThreshold);
    } catch (error) {
      console.error(`[preprocessing] 클러스터링 실패 (원본 유지):`, error);
    }
  }

  // 3. 댓글 압축
  comments = compressComments(comments, config.commentLimit);

  const optimizedArticles = articles.length;
  const optimizedComments = comments.length;
  const totalOriginal = originalArticles + originalComments;
  const totalOptimized = optimizedArticles + optimizedComments;
  const reductionPercent =
    totalOriginal > 0 ? Math.round(((totalOriginal - totalOptimized) / totalOriginal) * 100) : 0;

  return {
    input: { ...input, articles, comments },
    stats: {
      originalArticles,
      optimizedArticles,
      originalComments,
      optimizedComments,
      reductionPercent,
      preset,
    },
  };
}
```

- [ ] **Step 2: analysis/index.ts에 export 추가**

`packages/core/src/analysis/index.ts` 파일 끝에 추가:

```typescript
export * from './preprocessing';
```

- [ ] **Step 3: 커밋**

```bash
git add packages/core/src/analysis/preprocessing/index.ts packages/core/src/analysis/index.ts
git commit -m "feat: 전처리 통합 모듈 및 public API 노출"
```

---

### Task 7: DB 스키마 & tRPC 확장

**Files:**

- Modify: `packages/core/src/db/schema/collections.ts:41-43`
- Modify: `apps/web/src/server/trpc/routers/analysis.ts:23-27`

- [ ] **Step 1: DB options 타입 확장**

`packages/core/src/db/schema/collections.ts:41-43`에서:

```typescript
// 기존
  options: jsonb('options').$type<{
    enableItemAnalysis?: boolean; // 개별 기사/댓글 감정 분석 활성화
  }>(),
```

변경:

```typescript
  options: jsonb('options').$type<{
    enableItemAnalysis?: boolean;
    tokenOptimization?: 'none' | 'light' | 'standard' | 'aggressive';
  }>(),
```

- [ ] **Step 2: tRPC input schema 확장**

`apps/web/src/server/trpc/routers/analysis.ts:23-27`에서:

```typescript
// 기존
        options: z
          .object({
            enableItemAnalysis: z.boolean().optional(),
          })
          .optional(),
```

변경:

```typescript
        options: z
          .object({
            enableItemAnalysis: z.boolean().optional(),
            tokenOptimization: z
              .enum(['none', 'light', 'standard', 'aggressive'])
              .optional(),
          })
          .optional(),
```

- [ ] **Step 3: db:push 실행**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm db:push`
Expected: jsonb 내부 타입 변경이므로 마이그레이션 없이 완료

- [ ] **Step 4: 커밋**

```bash
git add packages/core/src/db/schema/collections.ts apps/web/src/server/trpc/routers/analysis.ts
git commit -m "feat: DB options 및 tRPC schema에 tokenOptimization 추가"
```

---

### Task 8: 파이프라인 오케스트레이터에 전처리 삽입

**Files:**

- Modify: `packages/core/src/analysis/pipeline-orchestrator.ts:302-350`

- [ ] **Step 1: import 추가**

`pipeline-orchestrator.ts` 상단 import에 추가:

```typescript
import { preprocessAnalysisInput, type OptimizationPreset } from './preprocessing';
```

- [ ] **Step 2: Stage 0과 Stage 1 사이에 전처리 삽입**

`pipeline-orchestrator.ts`에서 기존 코드:

```typescript
// Stage 1: 병렬 실행 (모듈 1~4, 독립) — Stage 0과 동시 진행
console.log(`[pipeline] Stage 1 시작: 기본 분석 (${STAGE1_MODULES.map((m) => m.name).join(', ')})`);
```

이 줄 바로 위에 전처리 로직 삽입:

```typescript
// 토큰 최적화 전처리
const tokenOptimization = (jobRow?.options?.tokenOptimization ?? 'none') as OptimizationPreset;
if (tokenOptimization !== 'none') {
  try {
    await updateJobProgress(jobId, {
      'token-optimization': { status: 'running', preset: tokenOptimization },
    }).catch(() => {});
    console.log(`[pipeline] 토큰 최적화 시작: preset=${tokenOptimization}, job=${jobId}`);

    const preprocessed = await preprocessAnalysisInput(input, tokenOptimization, jobId);
    input = preprocessed.input;

    await updateJobProgress(jobId, {
      'token-optimization': {
        status: 'completed',
        phase: 'preprocessing',
        ...preprocessed.stats,
      },
    }).catch(() => {});
    console.log(
      `[pipeline] 토큰 최적화 완료: 기사 ${preprocessed.stats.originalArticles}→${preprocessed.stats.optimizedArticles}, 댓글 ${preprocessed.stats.originalComments}→${preprocessed.stats.optimizedComments} (${preprocessed.stats.reductionPercent}%↓)`,
    );
  } catch (error) {
    console.error(`[pipeline] 토큰 최적화 실패 (원본 데이터로 계속 진행):`, error);
    await updateJobProgress(jobId, {
      'token-optimization': { status: 'failed', phase: 'error' },
    }).catch(() => {});
  }
} else {
  await updateJobProgress(jobId, {
    'token-optimization': { status: 'skipped' },
  }).catch(() => {});
}

// Stage 1: 병렬 실행 (모듈 1~4, 독립) — Stage 0과 동시 진행
```

주의: `input`은 `let`으로 선언되어 있어야 합니다. 현재 `const`라면 `let`으로 변경해야 합니다.

- [ ] **Step 3: 커밋**

```bash
git add packages/core/src/analysis/pipeline-orchestrator.ts
git commit -m "feat: 파이프라인에 토큰 최적화 전처리 단계 삽입"
```

---

### Task 9: 파이프라인 모니터에 전처리 단계 표시

**Files:**

- Modify: `apps/web/src/components/analysis/pipeline-monitor/constants.ts:271-277`
- Modify: `apps/web/src/components/analysis/pipeline-monitor/stage-flow.tsx:29-35`
- Modify: `apps/web/src/server/pipeline-status.ts:124-182`

- [ ] **Step 1: PIPELINE_STEPS에 단계 추가**

`constants.ts:271-277`에서:

```typescript
// 기존
export const PIPELINE_STEPS = [
  { key: 'collection', label: '수집' },
  { key: 'normalization', label: '정규화' },
  { key: 'item-analysis', label: '개별 감정' },
  { key: 'analysis', label: 'AI 분석' },
  { key: 'report', label: '리포트' },
] as const;
```

변경:

```typescript
export const PIPELINE_STEPS = [
  { key: 'collection', label: '수집' },
  { key: 'normalization', label: '정규화' },
  { key: 'token-optimization', label: '토큰 최적화' },
  { key: 'item-analysis', label: '개별 감정' },
  { key: 'analysis', label: 'AI 분석' },
  { key: 'report', label: '리포트' },
] as const;
```

- [ ] **Step 2: 아이콘 매핑 추가**

`stage-flow.tsx:29-35`에서:

```typescript
// 기존
const STAGE_ICONS: Record<string, typeof Download> = {
  collection: Download,
  normalization: Layers,
  'item-analysis': Heart,
  analysis: Beaker,
  report: FileText,
};
```

변경 (import에 `Zap` 추가 필요):

```typescript
const STAGE_ICONS: Record<string, typeof Download> = {
  collection: Download,
  normalization: Layers,
  'token-optimization': Zap,
  'item-analysis': Heart,
  analysis: Beaker,
  report: FileText,
};
```

stage-flow.tsx 상단 lucide-react import에 `Zap` 추가.

- [ ] **Step 3: 상태 유도 로직 추가**

`apps/web/src/server/pipeline-status.ts`의 pipelineStages 객체(L124-182)에서, `normalization` 뒤에 추가:

```typescript
    'token-optimization': {
      status: collectionFailed
        ? ('skipped' as const)
        : (() => {
            const tokenOptProgress = progress?.['token-optimization'] as
              | { status: string }
              | undefined;
            if (!tokenOptProgress || tokenOptProgress.status === 'skipped')
              return 'skipped' as const;
            if (tokenOptProgress.status === 'completed') return 'completed' as const;
            if (tokenOptProgress.status === 'failed') return 'failed' as const;
            if (tokenOptProgress.status === 'running') return 'running' as const;
            if (isCancelled) return 'cancelled' as const;
            return 'pending' as const;
          })(),
    },
```

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/components/analysis/pipeline-monitor/constants.ts apps/web/src/components/analysis/pipeline-monitor/stage-flow.tsx apps/web/src/server/pipeline-status.ts
git commit -m "feat: 파이프라인 모니터에 토큰 최적화 단계 표시"
```

---

### Task 10: 트리거 폼 UI 구현

**Files:**

- Modify: `apps/web/src/components/analysis/trigger-form.tsx`

- [ ] **Step 1: 프리셋 상수 import 및 상태 추가**

`trigger-form.tsx` 상단에 import 추가:

```typescript
import { OPTIMIZATION_PRESETS, type OptimizationPreset } from '@ai-signalcraft/core';
```

상태 추가 (L84 뒤):

```typescript
const [optimizationPreset, setOptimizationPreset] = useState<OptimizationPreset>('none');
```

- [ ] **Step 2: mutationFn 타입에 tokenOptimization 추가**

`trigger-form.tsx:112-124`에서 mutationFn input 타입에 추가:

```typescript
      options?: { enableItemAnalysis?: boolean; tokenOptimization?: OptimizationPreset };
```

- [ ] **Step 3: handleSubmit에서 options에 프리셋 포함**

`trigger-form.tsx:152-164`에서:

```typescript
// 기존
      options: enableItemAnalysis ? { enableItemAnalysis: true } : undefined,
```

변경:

```typescript
      options:
        enableItemAnalysis || optimizationPreset !== 'none'
          ? {
              ...(enableItemAnalysis && { enableItemAnalysis: true }),
              ...(optimizationPreset !== 'none' && { tokenOptimization: optimizationPreset }),
            }
          : undefined,
```

- [ ] **Step 4: Collapsible 헤더 변경**

`trigger-form.tsx:349-355`에서:

```typescript
// 기존
          <Collapsible open={isLimitsOpen} onOpenChange={setIsLimitsOpen}>
            <CollapsibleTrigger className="w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-accent transition-colors cursor-pointer">
              <span className="font-medium">수집 한도 설정</span>
```

변경:

```typescript
          <Collapsible open={isLimitsOpen} onOpenChange={setIsLimitsOpen}>
            <CollapsibleTrigger className="w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-accent transition-colors cursor-pointer">
              <div className="flex items-center gap-2">
                <span className="font-medium">수집 한도 & 토큰 최적화</span>
                {optimizationPreset !== 'none' && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      optimizationPreset === 'light'
                        ? 'bg-green-500/15 text-green-500'
                        : optimizationPreset === 'standard'
                          ? 'bg-yellow-500/15 text-yellow-500'
                          : 'bg-orange-500/15 text-orange-500'
                    }`}
                  >
                    {OPTIMIZATION_PRESETS[optimizationPreset].label}{' '}
                    {OPTIMIZATION_PRESETS[optimizationPreset].estimatedReduction}↓
                  </span>
                )}
              </div>
```

- [ ] **Step 5: Collapsible 내부에 프리셋 UI 추가**

`trigger-form.tsx`에서 수집 한도 그리드(`</div>` — maxCommentsPerItem Input 뒤)와 `</div>` (rounded-lg border p-3 닫힘) 사이에 추가:

```typescript
                {/* 구분선 */}
                <div className="border-t my-1" />

                {/* 토큰 최적화 프리셋 */}
                <div className="space-y-2">
                  <Label className="text-xs">토큰 최적화</Label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(
                      Object.entries(OPTIMIZATION_PRESETS) as [
                        OptimizationPreset,
                        (typeof OPTIMIZATION_PRESETS)[OptimizationPreset],
                      ][]
                    ).map(([key, preset]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setOptimizationPreset(key)}
                        disabled={triggerMutation.isPending}
                        className={`rounded-md border p-2 text-center transition-colors ${
                          optimizationPreset === key
                            ? key === 'none'
                              ? 'border-zinc-500 bg-zinc-500/10'
                              : key === 'light'
                                ? 'border-green-500 bg-green-500/10'
                                : key === 'standard'
                                  ? 'border-yellow-500 bg-yellow-500/10'
                                  : 'border-orange-500 bg-orange-500/10'
                            : 'border-border hover:bg-accent'
                        }`}
                      >
                        <div
                          className={`text-xs font-medium ${
                            optimizationPreset === key
                              ? key === 'none'
                                ? 'text-zinc-400'
                                : key === 'light'
                                  ? 'text-green-500'
                                  : key === 'standard'
                                    ? 'text-yellow-500'
                                    : 'text-orange-500'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {preset.label}
                        </div>
                        {key !== 'none' && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {preset.estimatedReduction}↓
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  {optimizationPreset !== 'none' && (
                    <div
                      className={`rounded-md p-2 text-xs border-l-2 ${
                        optimizationPreset === 'light'
                          ? 'border-l-green-500 bg-green-500/5 text-green-200'
                          : optimizationPreset === 'standard'
                            ? 'border-l-yellow-500 bg-yellow-500/5 text-yellow-200'
                            : 'border-l-orange-500 bg-orange-500/5 text-orange-200'
                      }`}
                    >
                      {OPTIMIZATION_PRESETS[optimizationPreset].description}
                    </div>
                  )}
                </div>
```

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/components/analysis/trigger-form.tsx
git commit -m "feat: 트리거 폼에 토큰 최적화 프리셋 UI 추가"
```

---

### Task 11: 린트 & 통합 검증

**Files:** None (검증만)

- [ ] **Step 1: 린트 실행**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm lint`
Expected: 에러 없음

- [ ] **Step 2: 포맷 실행**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm format`

- [ ] **Step 3: 전체 테스트 실행**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm test`
Expected: 모든 테스트 통과

- [ ] **Step 4: 빌드 확인**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm build`
Expected: 빌드 성공

- [ ] **Step 5: 린트/포맷 수정사항 커밋 (있다면)**

```bash
git add -A && git commit -m "style: 린트 및 포맷 수정"
```
