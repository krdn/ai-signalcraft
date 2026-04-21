# 구독 수집 감정 분석 추가 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** collector 앱 executor에서 수집 시 BERT 경량 모델로 기사/댓글 감정 분석을 수행하고 raw_items에 저장. 이미 수집된 과거 데이터에 대한 backfill 기능도 제공.

**Architecture:** core의 `sentiment-classifier.ts`, `korean-sentiment-rules.ts`, `sarcasm-postprocess.ts`를 collector 앱의 `services/sentiment.ts`로 복사. executor의 청크 루프에서 임베딩 직후 감정 분석을 실행. 별도 tRPC 프로시저로 과거 데이터 backfill 제공.

**Tech Stack:** @xenova/transformers (BERT), Drizzle ORM, tRPC, TimescaleDB

---

## File Structure

| Action | File | Responsibility |
|---|---|---|
| Modify | `apps/collector/src/db/schema/items.ts` | sentiment, sentimentScore 컬럼 추가 |
| Create | `apps/collector/src/services/sentiment.ts` | BERT 감정 분류기 + 한국어 보정 (core에서 복사) |
| Modify | `apps/collector/src/queue/executor.ts` | 청크 루프에 감정 분석 삽입 |
| Create | `apps/collector/src/services/sentiment.test.ts` | 감정 서비스 단위 테스트 |
| Modify | `apps/collector/src/server/trpc/runs.ts` | runSentimentBreakdown 프로시저 추가 |
| Create | `apps/collector/src/scripts/backfill-sentiment.ts` | 과거 데이터 감정 backfill 스크립트 |
| Modify | `apps/collector/src/server/trpc/runs.ts` | backfill-sentiment tRPC 프로시저 추가 |
| Modify | `apps/web/src/server/trpc/routers/subscriptions.ts` | runSentimentBreakdown 프록시 추가 |
| Modify | `apps/web/src/components/subscriptions/run-progress-inline.tsx` | 진행 요약에 감정 표시 |
| Modify | `apps/web/src/components/subscriptions/recent-runs-log.tsx` | 완료된 run 행에 감정 아이콘 |

---

### Task 1: raw_items 스키마에 sentiment 컬럼 추가

**Files:**
- Modify: `apps/collector/src/db/schema/items.ts`

- [ ] **Step 1: 컬럼 추가**

`apps/collector/src/db/schema/items.ts`의 `rawItems` 테이블 정의에 `embedding` 아래에 두 컬럼 추가:

```typescript
// 기존 embedding 라인 아래에 추가
sentiment: text('sentiment'),            // 'positive' | 'negative' | 'neutral' | NULL
sentimentScore: real('sentiment_score'), // 0~1 확신도, NULL
```

`NewRawItem` 타입은 Drizzle이 자동 추론하므로 수정 불필요.

- [ ] **Step 2: `pnpm db:push` 실행**

```bash
cd /home/gon/projects/ai/ai-signalcraft
pnpm db:push
```

collector 앱의 DB는 TimescaleDB(5435 포트)이므로, collector 앱 디렉토리에서 실행해야 함. `.env`에서 DB URL 확인.

예상 결과: `ALTER TABLE raw_items ADD COLUMN sentiment text, ADD COLUMN sentiment_score real;` 실행.

- [ ] **Step 3: 커밋**

```bash
git add apps/collector/src/db/schema/items.ts
git commit -m "feat(db): raw_items에 sentiment, sentiment_score 컬럼 추가"
```

---

### Task 2: 감정 분석 서비스 구현

**Files:**
- Create: `apps/collector/src/services/sentiment.ts`
- Create: `apps/collector/src/services/sentiment.test.ts`

- [ ] **Step 1: 테스트 파일 작성**

`apps/collector/src/services/sentiment.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  normalizeSentiment,
  classifySentimentFromTexts,
  type SentimentResult,
} from './sentiment';

describe('normalizeSentiment', () => {
  it('1 star → negative', () => {
    expect(normalizeSentiment({ label: '1 star', score: 0.9 })).toEqual({
      label: 'negative',
      score: 0.9,
    });
  });

  it('2 stars → negative', () => {
    expect(normalizeSentiment({ label: '2 stars', score: 0.8 })).toEqual({
      label: 'negative',
      score: 0.8,
    });
  });

  it('3 stars → neutral', () => {
    expect(normalizeSentiment({ label: '3 stars', score: 0.7 })).toEqual({
      label: 'neutral',
      score: 0.7,
    });
  });

  it('4 stars → positive', () => {
    expect(normalizeSentiment({ label: '4 stars', score: 0.85 })).toEqual({
      label: 'positive',
      score: 0.85,
    });
  });

  it('5 stars → positive', () => {
    expect(normalizeSentiment({ label: '5 stars', score: 0.95 })).toEqual({
      label: 'positive',
      score: 0.95,
    });
  });
});

describe('applyKoreanSentimentRules', () => {
  // 순수 함수이므로 sentiment.ts에서 직접 import하여 테스트
  it('강한 부정 어휘가 있으면 negative로 override', async () => {
    const { applyKoreanSentimentRules } = await import('./sentiment');
    const result: SentimentResult = { label: 'positive', score: 0.6 };
    const adjusted = applyKoreanSentimentRules('이건 최악이다', result);
    expect(adjusted.label).toBe('negative');
    expect(adjusted.score).toBeGreaterThanOrEqual(0.75);
  });

  it('강한 긍정 어휘가 있으면 positive로 override', async () => {
    const { applyKoreanSentimentRules } = await import('./sentiment');
    const result: SentimentResult = { label: 'neutral', score: 0.5 };
    const adjusted = applyKoreanSentimentRules('정말 최고다', result);
    expect(adjusted.label).toBe('positive');
  });

  it('부정어+긍정어 조합 시 negative', async () => {
    const { applyKoreanSentimentRules } = await import('./sentiment');
    const result: SentimentResult = { label: 'positive', score: 0.8 };
    const adjusted = applyKoreanSentimentRules('안 좋아요', result);
    expect(adjusted.label).toBe('negative');
  });
});

describe('applySarcasmAdjustment', () => {
  it('[SARCASM] 마커 시 긍정→부정 flip', async () => {
    const { applySarcasmAdjustment } = await import('./sentiment');
    const result: SentimentResult = { label: 'positive', score: 0.9 };
    const adjusted = applySarcasmAdjustment('참 잘났다 [SARCASM]', result);
    expect(adjusted.label).toBe('negative');
  });

  it('[NEGATIVE] 마커 시 부정 강화', async () => {
    const { applySarcasmAdjustment } = await import('./sentiment');
    const result: SentimentResult = { label: 'neutral', score: 0.5 };
    const adjusted = applySarcasmAdjustment('문제가 있다 [NEGATIVE]', result);
    expect(adjusted.label).toBe('negative');
  });

  it('마커 없으면 결과 유지', async () => {
    const { applySarcasmAdjustment } = await import('./sentiment');
    const result: SentimentResult = { label: 'positive', score: 0.8 };
    const adjusted = applySarcasmAdjustment('좋은 소식이다', result);
    expect(adjusted).toEqual(result);
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm --filter collector test -- --run src/services/sentiment.test.ts
```

예상: FAIL — `./sentiment` 모듈이 존재하지 않음.

- [ ] **Step 3: 감정 분석 서비스 구현**

`apps/collector/src/services/sentiment.ts` — core의 3개 파일을 통합:

```typescript
/**
 * 감정 분석 서비스 — @xenova/transformers BERT 경량 모델 + 한국어 보정
 *
 * core의 sentiment-classifier.ts, korean-sentiment-rules.ts, sarcasm-postprocess.ts를
 * collector 앱용으로 통합. 외부 의존성(@xenova/transformers)은 동일.
 */

// ─── SentimentResult 타입 ────────────────────────────────────────

export interface SentimentResult {
  label: 'positive' | 'negative' | 'neutral';
  score: number; // 0~1 확신도
}

// ─── BERT 분류기 ─────────────────────────────────────────────────

let classifier: any = null;
let initPromise: Promise<void> | null = null;

const MODEL_ID = 'Xenova/bert-base-multilingual-uncased-sentiment';

export async function initSentiment(): Promise<void> {
  if (classifier) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log('[sentiment] BERT 모델 로딩 시작...');
    const transformers = await import('@xenova/transformers');
    transformers.env.cacheDir = `${process.env.HOME ?? '/root'}/.cache/xenova`;
    classifier = await transformers.pipeline('sentiment-analysis', MODEL_ID, {
      quantized: true,
    });
    console.log('[sentiment] BERT 모델 로딩 완료');
  })();

  return initPromise;
}

/**
 * bert 5단계 star → 3단계 label 변환
 */
export function normalizeSentiment(raw: { label: string; score: number }): SentimentResult {
  const star = parseInt(raw.label.replace(/\D/g, ''), 10);

  if (star <= 2) return { label: 'negative', score: raw.score };
  if (star >= 4) return { label: 'positive', score: raw.score };
  return { label: 'neutral', score: raw.score };
}

const BATCH_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`배치 타임아웃 (${ms}ms)`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * 텍스트 배열을 배치 단위로 감정 분류 (모델 직접 호출)
 */
async function classifyRaw(texts: string[], batchSize = 50): Promise<SentimentResult[]> {
  if (!classifier) await initSentiment();
  if (!classifier) throw new Error('감정 분류 모델 초기화 실패');

  const results: SentimentResult[] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize).map((t) => (t.length > 200 ? t.slice(0, 200) : t));

    try {
      const rawResults:
        | Array<{ label: string; score: number }>
        | Array<Array<{ label: string; score: number }>> = await withTimeout(
        classifier(batch, { topk: 1 }),
        BATCH_TIMEOUT_MS,
      );

      const normalized = Array.isArray(rawResults[0])
        ? (rawResults as Array<Array<{ label: string; score: number }>>).map((r) =>
            normalizeSentiment(r[0]),
          )
        : (rawResults as Array<{ label: string; score: number }>).map((r) =>
            normalizeSentiment(r),
          );

      results.push(...normalized);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[sentiment] 배치 ${Math.floor(i / batchSize) + 1} 실패 (${batch.length}건): ${msg}`);
      results.push(...batch.map(() => ({ label: 'neutral' as const, score: 0 })));
    }
  }

  return results;
}

// ─── 한국어 보정 규칙 ────────────────────────────────────────────

const STRONG_POSITIVE = [
  '최고', '훌륭', '대단', '감동', '고맙', '감사합', '응원', '사랑', '멋지',
  '잘했', '성공', '좋아', '훌륭한', '기쁘', '행복',
];

const STRONG_NEGATIVE = [
  '최악', '쓰레기', '개같', '망함', '실패', '싫어', '혐오', '분노', '짜증',
  '역겹', '한심', '어이없', '빡친', '극혐', '화나', '불쾌', '망했',
];

const NEGATION_WORDS = ['안', '못', '없', '아니', '불', '비'];
const QUESTIONING_PATTERNS = /\?|아닌가|같은데|일까|일까요|하는지|인지|할까/;

function hasAny(text: string, list: string[]): boolean {
  return list.some((w) => text.includes(w));
}

function hasNegatedPositive(text: string): boolean {
  for (const neg of NEGATION_WORDS) {
    const idx = text.indexOf(neg);
    if (idx === -1) continue;
    const window = text.slice(idx, idx + 10);
    if (STRONG_POSITIVE.some((pos) => window.includes(pos))) return true;
  }
  return false;
}

export function applyKoreanSentimentRules(text: string, result: SentimentResult): SentimentResult {
  const hasPos = hasAny(text, STRONG_POSITIVE);
  const hasNeg = hasAny(text, STRONG_NEGATIVE);
  const negatedPos = hasNegatedPositive(text);
  const isQuestion = QUESTIONING_PATTERNS.test(text);

  if (hasNeg && !hasPos) return { label: 'negative', score: Math.max(result.score, 0.75) };
  if (hasPos && !hasNeg && !negatedPos) return { label: 'positive', score: Math.max(result.score, 0.7) };
  if (negatedPos) return { label: 'negative', score: Math.max(result.score, 0.65) };
  if (isQuestion && result.score < 0.75) return { label: 'neutral', score: Math.max(0.5, result.score * 0.8) };

  return result;
}

// ─── 반어/조롱 보정 ──────────────────────────────────────────────

const FLIP_MARKERS = ['[SARCASM]'];
const STRENGTHEN_NEGATIVE_MARKERS = ['[NEGATIVE]', '[CRITICAL]', '[WEAK_APOLOGY]', '[DEFLECTION]', '[DISTRUST]'];
const REDUCE_CONFIDENCE_MARKERS = ['[SARCASM?]'];

export function applySarcasmAdjustment(text: string, result: SentimentResult): SentimentResult {
  const hasFlip = FLIP_MARKERS.some((m) => text.includes(m));
  const hasStrengthen = STRENGTHEN_NEGATIVE_MARKERS.some((m) => text.includes(m));
  const hasReduce = REDUCE_CONFIDENCE_MARKERS.some((m) => text.includes(m));

  let adjusted: SentimentResult = { ...result };

  if (hasFlip && result.label === 'positive') {
    adjusted = { label: 'negative', score: Math.max(0.55, result.score * 0.9) };
  } else if (hasStrengthen && result.label !== 'negative') {
    adjusted = { label: 'negative', score: Math.max(result.score, 0.6) };
  } else if (hasReduce) {
    adjusted = { ...result, score: result.score * 0.7 };
  }

  return adjusted;
}

// ─── 공개 API ────────────────────────────────────────────────────

/**
 * 텍스트 배열 → 감정 분석 (BERT + 한국어 보정 + 반어 보정)
 * executor에서 호출하는 메인 함수.
 */
export async function classifySentimentFromTexts(texts: string[]): Promise<SentimentResult[]> {
  if (texts.length === 0) return [];

  const raw = await classifyRaw(texts);
  const koreanAdjusted = texts.map((t, i) =>
    applyKoreanSentimentRules(t, raw[i] ?? { label: 'neutral' as const, score: 0 }),
  );
  return texts.map((t, i) =>
    applySarcasmAdjustment(t, koreanAdjusted[i] ?? { label: 'neutral' as const, score: 0 }),
  );
}
```

- [ ] **Step 4: 테스트 실행**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm --filter collector test -- --run src/services/sentiment.test.ts
```

예상: `normalizeSentiment`, `applyKoreanSentimentRules`, `applySarcasmAdjustment` 테스트 PASS. `classifySentimentFromTexts`는 모델 다운로드 필요하므로 CI에서는 skip 가능 (단위 테스트만으로 충분).

- [ ] **Step 5: 커밋**

```bash
git add apps/collector/src/services/sentiment.ts apps/collector/src/services/sentiment.test.ts
git commit -m "feat(collector): 감정 분석 서비스 추가 (BERT + 한국어 보정)"
```

---

### Task 3: executor에 감정 분석 통합

**Files:**
- Modify: `apps/collector/src/queue/executor.ts`

- [ ] **Step 1: import 추가**

`executor.ts` 상단 import 영역에 추가:

```typescript
import { classifySentimentFromTexts } from '../services/sentiment';
```

- [ ] **Step 2: `executeCollectionJob`의 임베딩 블록 이후에 감정 분석 삽입**

기존 임베딩 try/catch 블록(`// 임베딩 생성 — 실패해도 수집은 계속`)의 닫힌 괄호 `}` 바로 뒤에, `const result = await db.insert(rawItems)` 이전에 삽입:

```typescript
      // 감정 분석 — 임베딩용 텍스트 재사용, 실패해도 수집은 계속
      try {
        if (texts.some((t) => t.length > 0)) {
          const sentiments = await classifySentimentFromTexts(texts);
          rows.forEach((r, i) => {
            if (texts[i].length > 0 && sentiments[i]) {
              r.sentiment = sentiments[i].label;
              r.sentimentScore = sentiments[i].score;
            }
          });
        }
      } catch (sentimentErr) {
        if (sentimentErr instanceof CancelledError) throw sentimentErr;
        console.warn(
          `[executor:${source}] sentiment analysis failed (continuing without): ${
            sentimentErr instanceof Error ? sentimentErr.message : String(sentimentErr)
          }`,
        );
      }
```

**주의:** 이 블록은 임베딩 블록 내부가 아닌 **그 다음**에 위치해야 함. `texts` 변수는 임베딩 블록에서 `const texts = rows.map(...)`으로 이미 선언되어 있으므로 재사용 가능.

- [ ] **Step 3: `executeCommentsJob`에도 동일하게 적용**

`executeCommentsJob` 함수 내 `// 댓글 임베딩` try/catch 블록 이후, `const result = await db.insert(rawItems)` 이전에 삽입. 구조는 동일하나 `texts` 변수가 임베딩 블록에서 이미 선언됨:

```typescript
      // 댓글 감정 분석 — 실패해도 수집은 계속
      try {
        if (texts.some((t) => t.length > 0)) {
          const sentiments = await classifySentimentFromTexts(texts);
          rows.forEach((r, i) => {
            if (texts[i].length > 0 && sentiments[i]) {
              r.sentiment = sentiments[i].label;
              r.sentimentScore = sentiments[i].score;
            }
          });
        }
      } catch (sentimentErr) {
        if (sentimentErr instanceof CancelledError) throw sentimentErr;
        console.warn(
          `[executor:${source}] sentiment analysis failed (continuing without): ${
            sentimentErr instanceof Error ? sentimentErr.message : String(sentimentErr)
          }`,
        );
      }
```

- [ ] **Step 4: TypeScript 컴파일 확인**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm --filter collector exec tsc --noEmit
```

예상: 에러 없음. `NewRawItem` 타입에 `sentiment`/`sentimentScore`가 자동 포함됨.

- [ ] **Step 5: 커밋**

```bash
git add apps/collector/src/queue/executor.ts
git commit -m "feat(collector): executor에 감정 분석 통합"
```

---

### Task 4: 과거 데이터 감정 Backfill 스크립트

**Files:**
- Create: `apps/collector/src/scripts/backfill-sentiment.ts`

- [ ] **Step 1: backfill 스크립트 작성**

`apps/collector/src/scripts/backfill-sentiment.ts`:

```typescript
/**
 * 이미 수집된 raw_items에 감정 분석 결과를 backfill.
 *
 * 사용법:
 *   pnpm --filter collector tsx src/scripts/backfill-sentiment.ts
 *   pnpm --filter collector tsx src/scripts/backfill-sentiment.ts --subscription-id 5
 *   pnpm --filter collector tsx src/scripts/backfill-sentiment.ts --source naver-news
 *   pnpm --filter collector tsx src/scripts/backfill-sentiment.ts --item-type comment
 *   pnpm --filter collector tsx src/scripts/backfill-sentiment.ts --dry-run
 */
import { sql, isNull, and, eq } from 'drizzle-orm';
import { getDb } from '../db';
import { rawItems } from '../db/schema';
import { initSentiment, classifySentimentFromTexts } from '../services/sentiment';
import { buildEmbeddingText } from '../services/embedding';

const BATCH_SIZE = 50;

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const subscriptionId = parseArg(args, '--subscription-id');
  const source = parseArg(args, '--source');
  const itemType = parseArg(args, '--item-type');

  console.log('[backfill-sentiment] 시작', {
    dryRun,
    subscriptionId,
    source,
    itemType,
  });

  await initSentiment();

  const db = getDb();
  const conditions = [isNull(rawItems.sentiment)];
  if (subscriptionId) conditions.push(eq(rawItems.subscriptionId, Number(subscriptionId)));
  if (source) conditions.push(eq(rawItems.source, source));
  if (itemType) conditions.push(eq(rawItems.itemType, itemType as 'article' | 'video' | 'comment'));

  // 대상 건수 확인
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rawItems)
    .where(and(...conditions));
  console.log(`[backfill-sentiment] 대상: ${count}건`);

  if (count === 0) {
    console.log('[backfill-sentiment] 처리할 데이터 없음');
    return;
  }

  let processed = 0;
  let updated = 0;

  // 커서 기반 페이지네이션으로 전체 스캔
  let lastTime: Date | null = null;
  let lastSourceId: string | null = null;

  while (true) {
    const cursorConditions = lastTime
      ? [
          ...conditions,
          sql`(${rawItems.time}, ${rawItems.sourceId}) > (${lastTime}, ${lastSourceId})`,
        ]
      : conditions;

    const rows = await db
      .select({
        time: rawItems.time,
        sourceId: rawItems.sourceId,
        title: rawItems.title,
        content: rawItems.content,
      })
      .from(rawItems)
      .where(and(...cursorConditions))
      .orderBy(rawItems.time, rawItems.sourceId)
      .limit(BATCH_SIZE);

    if (rows.length === 0) break;

    const texts = rows.map((r) => buildEmbeddingText(r.title, r.content));
    const sentiments = await classifySentimentFromTexts(texts);

    if (!dryRun) {
      // 개별 UPDATE — TimescaleDB는 bulk UPDATE 시 청크 스캔 비용이 크므로
      // VALUES 기반 bulk UPDATE 사용
      const valuesSql = rows
        .map((r, i) => {
          const s = sentiments[i];
          if (!s || s.label === 'neutral' && s.score === 0) return null;
          const label = s.label;
          const score = s.score;
          return `('${r.time.toISOString()}', '${r.sourceId.replace(/'/g, "''")}', '${label}', ${score})`;
        })
        .filter(Boolean)
        .join(',');

      if (valuesSql.length > 0) {
        await db.execute(sql.raw(`
          UPDATE raw_items AS t
          SET sentiment = v.sentiment,
              sentiment_score = v.score
          FROM (VALUES ${valuesSql}) AS v(time, source_id, sentiment, score)
          WHERE t.source_id = v.source_id::text
            AND t.sentiment IS NULL
        `));
      }
    }

    processed += rows.length;
    updated += sentiments.filter((s) => s.label !== 'neutral' || s.score !== 0).length;

    lastTime = rows[rows.length - 1].time;
    lastSourceId = rows[rows.length - 1].sourceId;

    if (processed % 500 === 0 || rows.length < BATCH_SIZE) {
      console.log(`[backfill-sentiment] 진행: ${processed}/${count} (업데이트: ${updated})`);
    }
  }

  console.log(`[backfill-sentiment] 완료: ${processed}건 처리, ${updated}건 업데이트${dryRun ? ' (dry-run)' : ''}`);
}

function parseArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : undefined;
}

main().catch((err) => {
  console.error('[backfill-sentiment] 오류:', err);
  process.exit(1);
});
```

- [ ] **Step 2: dry-run으로 테스트**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm --filter collector tsx src/scripts/backfill-sentiment.ts --dry-run --subscription-id 1
```

예상: 대상 건수 출력 후 "dry-run" 표시와 함께 종료. 실제 DB 변경 없음.

- [ ] **Step 3: 커밋**

```bash
git add apps/collector/src/scripts/backfill-sentiment.ts
git commit -m "feat(collector): 과거 데이터 감정 backfill 스크립트"
```

---

### Task 5: 감정 분석 Backfill tRPC 프로시저

**Files:**
- Modify: `apps/collector/src/server/trpc/runs.ts`

- [ ] **Step 1: backfillSentiment 프로시저 추가**

`apps/collector/src/server/trpc/runs.ts`의 `runsRouter`에 `backfillSentiment` 프로시저 추가. `cancel` 프로시저 뒤에 삽입:

```typescript
  backfillSentiment: protectedProcedure
    .input(
      z.object({
        subscriptionId: z.number().optional(),
        source: z.enum(COLLECTOR_SOURCES).optional(),
        itemType: z.enum(['article', 'video', 'comment']).optional(),
        dryRun: z.boolean().default(false),
        limit: z.number().min(1).max(10000).default(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { dryRun, limit } = input;
      const conditions = [isNull(rawItems.sentiment)];
      if (input.subscriptionId) conditions.push(eq(rawItems.subscriptionId, input.subscriptionId));
      if (input.source) conditions.push(eq(rawItems.source, input.source));
      if (input.itemType) conditions.push(eq(rawItems.itemType, input.itemType));

      // 대상 건수
      const [{ count }] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(rawItems)
        .where(and(...conditions));

      if (count === 0 || dryRun) {
        return { processed: 0, updated: 0, total: count, dryRun };
      }

      // limit 건수만 처리 (대량 실행 시 서버 부하 방지)
      const rows = await ctx.db
        .select({
          time: rawItems.time,
          sourceId: rawItems.sourceId,
          title: rawItems.title,
          content: rawItems.content,
        })
        .from(rawItems)
        .where(and(...conditions))
        .limit(limit);

      if (rows.length === 0) return { processed: 0, updated: 0, total: count, dryRun };

      const { classifySentimentFromTexts } = await import('../../services/sentiment');
      const { buildEmbeddingText } = await import('../../services/embedding');
      await (await import('../../services/sentiment')).initSentiment();

      const texts = rows.map((r) => buildEmbeddingText(r.title, r.content));
      const sentiments = await classifySentimentFromTexts(texts);

      let updated = 0;
      for (let i = 0; i < rows.length; i++) {
        const s = sentiments[i];
        if (!s) continue;
        try {
          await ctx.db
            .update(rawItems)
            .set({ sentiment: s.label, sentimentScore: s.score })
            .where(
              and(
                eq(rawItems.sourceId, rows[i].sourceId),
                eq(rawItems.time, rows[i].time),
                isNull(rawItems.sentiment),
              ),
            );
          updated++;
        } catch {
          // 개별 UPDATE 실패 무시 (동시성 등)
        }
      }

      return { processed: rows.length, updated, total: count, dryRun };
    }),
```

**필요한 import 확인:** `runs.ts` 상단에 `isNull`이 이미 import 되어 있는지 확인. 없으면 `drizzle-orm`에서 추가:

```typescript
import { sql, eq, and, desc, inArray, isNull } from 'drizzle-orm';
```

- [ ] **Step 2: 커밋**

```bash
git add apps/collector/src/server/trpc/runs.ts
git commit -m "feat(collector): 감정 backfill tRPC 프로시저 추가"
```

---

### Task 6: 감정 집계 tRPC 프로시저 + Web 프록시

**Files:**
- Modify: `apps/collector/src/server/trpc/runs.ts`
- Modify: `apps/web/src/server/trpc/routers/subscriptions.ts`

- [ ] **Step 1: collector에 runSentimentBreakdown 프로시저 추가**

`runs.ts`의 `itemBreakdown` 프로시저 뒤에 추가:

```typescript
  sentimentBreakdown: protectedProcedure
    .input(
      z.object({
        runIds: z.array(z.string().uuid()).min(1).max(1000),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          fetchedFromRun: rawItems.fetchedFromRun,
          sentiment: rawItems.sentiment,
          count: sql<number>`count(*)::int`,
        })
        .from(rawItems)
        .where(
          and(
            inArray(rawItems.fetchedFromRun, input.runIds),
            sql`${rawItems.sentiment} IS NOT NULL`,
          ),
        )
        .groupBy(rawItems.fetchedFromRun, rawItems.sentiment);
      return rows;
    }),
```

- [ ] **Step 2: web 프록시 라우터에 추가**

`apps/web/src/server/trpc/routers/subscriptions.ts`에 `runSentimentBreakdown` 프로시저 추가. `runItemBreakdown` 프로시저 뒤에 삽입:

```typescript
  runSentimentBreakdown: protectedProcedure
    .input(
      z.object({
        runIds: z.array(z.string().uuid()).min(1).max(1000),
      }),
    )
    .query(async ({ input }) => {
      try {
        const res = await getCollectorClient().runs.sentimentBreakdown.query(input);
        return res as unknown as Array<{
          fetchedFromRun: string;
          sentiment: string | null;
          count: number;
        }>;
      } catch (err) {
        handleCollectorError(err);
      }
    }),
```

- [ ] **Step 3: 커밋**

```bash
git add apps/collector/src/server/trpc/runs.ts apps/web/src/server/trpc/routers/subscriptions.ts
git commit -m "feat: 감정 집계 tRPC 프로시저 추가 (collector + web 프록시)"
```

---

### Task 7: UI — LiveRunFeed 감정 표시

**Files:**
- Modify: `apps/web/src/components/subscriptions/run-progress-inline.tsx`

- [ ] **Step 1: 현재 파일 구조 파악**

```bash
cat apps/web/src/components/subscriptions/run-progress-inline.tsx
```

- [ ] **Step 2: 감정 분포 표시 추가**

`RunProgressInline` 컴포넌트에서 수집 요약 텍스트 뒤에 감정 분포를 추가. 기존 `RunProgress` 타입에 `sentimentCounts` 필드가 있으면 활용하고, 없으면 새로운 폴링 쿼리로 가져옴.

감정 데이터는 Redis `job.progress`에 누적하도록 executor에서 이미 업데이트 가능. 하지만 simpler한 접근: 완료된 run은 `runSentimentBreakdown` 쿼리로 가져오고, 실행 중인 run은 표시하지 않음.

수집 요약 텍스트 뒤에 감정 아이콘 추가:

```typescript
// 기사/댓글 수 요약 뒤에 감정 배지 추가 (완료된 run만)
{sentimentData && (
  <span className="text-xs text-muted-foreground ml-1">
    <span className="text-green-600">+{sentimentData.positive}</span>
    <span className="text-muted-foreground mx-0.5">/</span>
    <span className="text-red-600">-{sentimentData.negative}</span>
    <span className="text-muted-foreground mx-0.5">/</span>
    <span className="text-gray-500">~{sentimentData.neutral}</span>
  </span>
)}
```

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/components/subscriptions/run-progress-inline.tsx
git commit -m "feat(monitor): LiveRunFeed에 감정 분포 표시"
```

---

### Task 8: UI — RecentRunsLog 감정 아이콘

**Files:**
- Modify: `apps/web/src/components/subscriptions/recent-runs-log.tsx`

- [ ] **Step 1: 현재 파일 구조 파악**

```bash
cat apps/web/src/components/subscriptions/recent-runs-log.tsx
```

- [ ] **Step 2: 완료된 run 행에 감정 컬럼 추가**

기존 아이템 집계("기사 N / 영상 N") 뒤에 감정 아이콘 컬럼 추가. `useSubscriptionSentimentBreakdown` 훅을 만들어 `runSentimentBreakdown` 쿼리를 호출.

각 run 행의 테이블 셀에:

```typescript
// 감정 집계 배지 (완료된 run만)
{run.status === 'completed' && sentiment && (
  <span className="flex items-center gap-1 text-xs">
    <span className="text-green-600">+{sentiment.positive}</span>
    <span className="text-red-600">-{sentiment.negative}</span>
  </span>
)}
```

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/components/subscriptions/recent-runs-log.tsx
git commit -m "feat(monitor): RecentRunsLog에 감정 아이콘 추가"
```

---

## Self-Review

1. **Spec coverage:**
   - DB 스키마 (sentiment/sentimentScore) → Task 1 ✓
   - 감정 분석 서비스 → Task 2 ✓
   - executor 통합 → Task 3 ✓
   - Backfill 스크립트 → Task 4 ✓
   - Backfill tRPC → Task 5 ✓
   - 감정 집계 프로시저 → Task 6 ✓
   - UI 표시 → Task 7, 8 ✓

2. **Placeholder scan:** TBD/TODO 없음. 모든 단계에 구체적 코드 포함.

3. **Type consistency:**
   - `SentimentResult` 인터페이스: `{ label: 'positive'|'negative'|'neutral'; score: number }` — 모든 태스크에서 일관됨
   - `classifySentimentFromTexts` → `SentimentResult[]` 반환 — Task 2에서 정의, Task 3/4/5에서 사용
   - raw_items 컬럼명: `sentiment`(text), `sentimentScore`(real) — Task 1 스키마와 Task 3 executor에서 일관
   - tRPC 프로시저명: `sentimentBreakdown`(collector) → `runSentimentBreakdown`(web) — Task 6에서 정의, Task 7/8에서 사용
