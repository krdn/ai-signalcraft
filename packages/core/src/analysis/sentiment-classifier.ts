// 경량 감정 분류기 — @xenova/transformers 기반
// 1차 빠른 분류 후 애매한 건만 LLM 재분석하는 하이브리드 구조의 1차 엔진
// NOTE: @xenova/transformers는 import만으로 ONNX Runtime을 초기화하여 블로킹됨
// → dynamic import로 실제 사용 시점에만 로딩

let classifier: any = null;
let initPromise: Promise<void> | null = null;

/** 다국어 감정 분류 모델 (한국어 포함, ~120MB) */
const MODEL_ID = 'Xenova/bert-base-multilingual-uncased-sentiment';

/**
 * 분류기 싱글톤 초기화 — Worker 시작 시 1회 호출
 * 첫 호출 시 모델 다운로드 후 로컬 캐시
 */
export async function initClassifier(): Promise<void> {
  if (classifier) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log('[sentiment-classifier] 경량 모델 로딩 시작...');
    const transformers = await import('@xenova/transformers');
    // 캐시 경로를 홈 디렉토리 고정 — 워커 cwd와 무관하게 동일 캐시 사용
    transformers.env.cacheDir = `${process.env.HOME ?? '/root'}/.cache/xenova`;
    classifier = await transformers.pipeline('sentiment-analysis', MODEL_ID, {
      quantized: true, // INT8 양자화 — 메모리 절약
    });
    console.log('[sentiment-classifier] 경량 모델 로딩 완료');
  })();

  return initPromise;
}

export interface SentimentResult {
  label: 'positive' | 'negative' | 'neutral';
  score: number; // 0~1 확신도
}

/**
 * bert-base-multilingual-uncased-sentiment 모델의 5단계 레이블을
 * 3단계(positive/negative/neutral) + 확신도로 변환
 *
 * 원본 레이블: 1 star ~ 5 stars
 * - 1, 2 stars → negative
 * - 3 stars → neutral
 * - 4, 5 stars → positive
 */
function normalizeSentiment(raw: { label: string; score: number }): SentimentResult {
  const star = parseInt(raw.label.replace(/\D/g, ''), 10);

  if (star <= 2) {
    return { label: 'negative', score: raw.score };
  }
  if (star >= 4) {
    return { label: 'positive', score: raw.score };
  }
  // 3 stars → neutral
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
 * 텍스트 배열을 배치 단위로 감정 분류
 * @param texts 분석 대상 텍스트
 * @param options.batchSize 배치 크기 (기본 64)
 * @param options.onBatchDone 배치 완료 콜백 (진행률 추적용)
 * @returns 입력 순서 그대로 분류 결과 (타임아웃 배치는 neutral 처리)
 */
export async function classifySentiment(
  texts: string[],
  options?: { batchSize?: number; onBatchDone?: (processed: number, total: number) => void },
): Promise<SentimentResult[]> {
  const batchSize = options?.batchSize ?? 64;
  if (!classifier) await initClassifier();
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
        `[sentiment-classifier] 배치 ${i / batchSize + 1} 실패 (${batch.length}건): ${msg}`,
      );
      // 실패 배치는 neutral/score 0으로 채워서 인덱스 정합성 유지
      results.push(...batch.map(() => ({ label: 'neutral' as const, score: 0 })));
    }

    options?.onBatchDone?.(Math.min(i + batchSize, texts.length), texts.length);
  }

  return results;
}

/** 판별이 애매한 건인지 확인 (score 0.4~0.65 → LLM 재분석 대상) */
export function isAmbiguous(score: number): boolean {
  return score >= 0.4 && score <= 0.65;
}

/** 확신도 임계값 (이 이상이면 LLM 재분석 불필요) */
export const CONFIDENCE_THRESHOLD = 0.65;

/** 애매한 판별 하한 (이 이하면 오히려 확실한 반대 감정) */
export const AMBIGUOUS_LOWER = 0.4;
