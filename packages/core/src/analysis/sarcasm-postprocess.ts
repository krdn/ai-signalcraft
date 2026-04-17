/**
 * 반어 마커 기반 sentiment 후처리
 *
 * 정규화 단계에서 [SARCASM] 마커가 붙은 텍스트의 감정 분류 결과를 보정한다.
 * BERT 감정 분류기는 반어를 탐지하지 못하고 표면 감정만 본다 (예: "참 잘났다 [SARCASM]"을
 * 긍정으로 분류). 이를 [SARCASM] 마커 존재 시 부정으로 뒤집는다.
 *
 * 마커 의미:
 *   [SARCASM]        → 명시적 반어: 감정 flip
 *   [SARCASM?]       → 잠재적 반어: 확신도 감소만 (flip 안 함)
 *   [NEGATIVE]       → 부정 강화
 *   [CRITICAL]       → 부정 강화
 *   [WEAK_APOLOGY]   → 부정 강화 (PR 도메인)
 *   [DEFLECTION]     → 부정 강화 (PR 도메인)
 *   [DISTRUST]       → 부정 강화 (healthcare)
 *   [SARCASM?]       → 확신도 × 0.7
 */
import type { SentimentResult } from './sentiment-classifier';

const FLIP_MARKERS = ['[SARCASM]'];
const STRENGTHEN_NEGATIVE_MARKERS = [
  '[NEGATIVE]',
  '[CRITICAL]',
  '[WEAK_APOLOGY]',
  '[DEFLECTION]',
  '[DISTRUST]',
];
const REDUCE_CONFIDENCE_MARKERS = ['[SARCASM?]'];

/**
 * 단일 (text, sentimentResult)를 후처리
 */
export function applySarcasmAdjustment(text: string, result: SentimentResult): SentimentResult {
  const hasFlip = FLIP_MARKERS.some((m) => text.includes(m));
  const hasStrengthen = STRENGTHEN_NEGATIVE_MARKERS.some((m) => text.includes(m));
  const hasReduce = REDUCE_CONFIDENCE_MARKERS.some((m) => text.includes(m));

  let adjusted: SentimentResult = { ...result };

  if (hasFlip && result.label === 'positive') {
    // 표면적으로 긍정이지만 반어 마커 → 부정
    adjusted = { label: 'negative', score: Math.max(0.55, result.score * 0.9) };
  } else if (hasStrengthen && result.label !== 'negative') {
    // 부정 강화 마커 → 최소 negative로
    adjusted = { label: 'negative', score: Math.max(result.score, 0.6) };
  } else if (hasReduce) {
    // 확신 낮춤
    adjusted = { ...result, score: result.score * 0.7 };
  }

  return adjusted;
}

/**
 * 배치 후처리
 */
export function applySarcasmAdjustments(
  texts: string[],
  results: SentimentResult[],
): SentimentResult[] {
  return texts.map((t, i) =>
    applySarcasmAdjustment(t, results[i] ?? { label: 'neutral', score: 0 }),
  );
}
