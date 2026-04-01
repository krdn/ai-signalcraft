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
    transformers.env.cacheDir = `${process.env.HOME ?? '/home/gon'}/.cache/xenova`;
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

/**
 * 텍스트 배열을 한 번에 감정 분류
 * @param texts 분석 대상 텍스트 (댓글/기사 제목 등)
 * @param batchSize 내부 배치 크기 (메모리 관리, 기본 64)
 * @returns 입력 순서 그대로 분류 결과
 */
export async function classifySentiment(
  texts: string[],
  batchSize = 64,
): Promise<SentimentResult[]> {
  if (!classifier) await initClassifier();
  if (!classifier) throw new Error('감정 분류 모델 초기화 실패');

  const results: SentimentResult[] = [];

  // 메모리 관리를 위해 내부적으로 배치 분할
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize).map(
      // 모델 입력 최대 512 토큰 — 한국어 약 200자
      t => (t.length > 200 ? t.slice(0, 200) : t),
    );
    const rawResults = await classifier(batch, { topk: 1 });

    // 결과 정규화: 단일 입력이면 배열이 아닌 객체로 올 수 있음
    const normalized = Array.isArray(rawResults[0])
      ? (rawResults as Array<Array<{ label: string; score: number }>>).map(r => normalizeSentiment(r[0]))
      : (rawResults as Array<{ label: string; score: number }>).map(r => normalizeSentiment(r));

    results.push(...normalized);
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
