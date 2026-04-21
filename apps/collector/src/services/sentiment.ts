/**
 * 감정 분석 서비스 — @xenova/transformers BERT 경량 모델 + 한국어 보정
 *
 * Xenova/bert-base-multilingual-uncased-sentiment (5단계 star → 3단계 label 변환)
 * 한국어 특화 보정 규칙 + 반어/조롱 마커 보정 적용
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
        : (rawResults as Array<{ label: string; score: number }>).map((r) => normalizeSentiment(r));

      results.push(...normalized);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[sentiment] 배치 ${Math.floor(i / batchSize) + 1} 실패 (${batch.length}건): ${msg}`,
      );
      results.push(...batch.map(() => ({ label: 'neutral' as const, score: 0 })));
    }
  }

  return results;
}

// ─── 한국어 보정 규칙 ────────────────────────────────────────────

const STRONG_POSITIVE = [
  '최고',
  '훌륭',
  '대단',
  '감동',
  '고맙',
  '감사합',
  '응원',
  '사랑',
  '멋지',
  '잘했',
  '성공',
  '좋아',
  '훌륭한',
  '기쁘',
  '행복',
];

const STRONG_NEGATIVE = [
  '최악',
  '쓰레기',
  '개같',
  '망함',
  '실패',
  '싫어',
  '혐오',
  '분노',
  '짜증',
  '역겹',
  '한심',
  '어이없',
  '빡친',
  '극혐',
  '화나',
  '불쾌',
  '망했',
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
  if (hasPos && !hasNeg && !negatedPos)
    return { label: 'positive', score: Math.max(result.score, 0.7) };
  if (negatedPos) return { label: 'negative', score: Math.max(result.score, 0.65) };
  if (isQuestion && result.score < 0.75)
    return { label: 'neutral', score: Math.max(0.5, result.score * 0.8) };

  return result;
}

// ─── 반어/조롱 보정 ──────────────────────────────────────────────

const FLIP_MARKERS = ['[SARCASM]'];
const STRENGTHEN_NEGATIVE_MARKERS = [
  '[NEGATIVE]',
  '[CRITICAL]',
  '[WEAK_APOLOGY]',
  '[DEFLECTION]',
  '[DISTRUST]',
];
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
