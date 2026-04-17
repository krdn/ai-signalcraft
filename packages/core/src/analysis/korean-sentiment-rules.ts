/**
 * 한국어 감정 분류 보정 규칙
 *
 * 현재 사용 중인 `bert-base-multilingual-uncased-sentiment`는
 * 리뷰 도메인(1~5 star)으로 학습되어 한국어 커뮤니티 담론에 최적화되지 않았다.
 *
 * KcBERT fine-tune이 이상적이지만 학습 데이터/인프라 필요.
 * 단기 대안: 규칙 기반 보정 레이어 추가 — BERT 결과 + 한국어 패턴 매칭으로 정확도 향상.
 *
 * 적용 패턴:
 *   1. 명확한 긍정/부정 어휘 사전으로 overrride
 *   2. 부정어("안", "못", "없") 앞뒤 맥락 고려
 *   3. 강조어("진짜", "정말", "완전") score 부스트
 *   4. 의문/추측 표현 감지 → neutral 보정
 */
import type { SentimentResult } from './sentiment-classifier';

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

/** 부정어 + 긍정 어휘 = 부정 전환 탐지 */
function hasNegatedPositive(text: string): boolean {
  // 간단한 근접성 체크: 부정어 뒤 10자 내에 긍정 어휘가 있으면 부정 전환
  for (const neg of NEGATION_WORDS) {
    const idx = text.indexOf(neg);
    if (idx === -1) continue;
    const window = text.slice(idx, idx + 10);
    if (STRONG_POSITIVE.some((pos) => window.includes(pos))) return true;
  }
  return false;
}

/**
 * BERT 결과를 한국어 패턴으로 보정
 */
export function applyKoreanSentimentRules(text: string, result: SentimentResult): SentimentResult {
  const hasPos = hasAny(text, STRONG_POSITIVE);
  const hasNeg = hasAny(text, STRONG_NEGATIVE);
  const negatedPos = hasNegatedPositive(text);
  const isQuestion = QUESTIONING_PATTERNS.test(text);

  // 강한 부정 어휘 존재 → 부정으로 override (score도 강화)
  if (hasNeg && !hasPos) {
    return { label: 'negative', score: Math.max(result.score, 0.75) };
  }

  // 강한 긍정 어휘 존재 + 부정어로 뒤집히지 않음
  if (hasPos && !hasNeg && !negatedPos) {
    return { label: 'positive', score: Math.max(result.score, 0.7) };
  }

  // 부정어로 뒤집힌 긍정 (예: "안 좋아요", "못 했어")
  if (negatedPos) {
    return { label: 'negative', score: Math.max(result.score, 0.65) };
  }

  // 의문/추측 표현이 지배적이면 neutral로 낮춤
  if (isQuestion && result.score < 0.75) {
    return { label: 'neutral', score: Math.max(0.5, result.score * 0.8) };
  }

  return result;
}

/** 배치 적용 */
export function applyKoreanSentimentRulesAll(
  texts: string[],
  results: SentimentResult[],
): SentimentResult[] {
  return texts.map((t, i) =>
    applyKoreanSentimentRules(t, results[i] ?? { label: 'neutral', score: 0 }),
  );
}
