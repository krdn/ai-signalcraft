// 정량 델타 계산 — 순수 함수 (IO 없음)
import type { SentimentFramingResult } from '../schemas/sentiment-framing.schema';
import type { MacroViewResult } from '../schemas/macro-view.schema';
import type { QuantitativeDelta } from './delta-schema';

export interface ModuleResults {
  sentimentFraming: SentimentFramingResult;
  macroView: MacroViewResult;
}

export interface CollectionStats {
  newArticles: number;
  newComments: number;
  totalArticles: number;
  totalComments: number;
}

/**
 * 이전/현재 분석 결과를 비교하여 정량 델타 계산
 */
export function computeQuantitativeDelta(
  before: ModuleResults,
  after: ModuleResults,
  collectionStats: CollectionStats,
): QuantitativeDelta {
  // 1. 감성 비율 변화
  const sentimentBefore = {
    positive: before.sentimentFraming.sentimentRatio.positive,
    negative: before.sentimentFraming.sentimentRatio.negative,
    neutral: before.sentimentFraming.sentimentRatio.neutral,
  };
  const sentimentAfter = {
    positive: after.sentimentFraming.sentimentRatio.positive,
    negative: after.sentimentFraming.sentimentRatio.negative,
    neutral: after.sentimentFraming.sentimentRatio.neutral,
  };
  const sentimentDelta = {
    positive: sentimentAfter.positive - sentimentBefore.positive,
    negative: sentimentAfter.negative - sentimentBefore.negative,
    neutral: sentimentAfter.neutral - sentimentBefore.neutral,
  };

  // 2. 언급량 변화 (dailyMentionTrend 합산)
  const mentionsBefore = before.macroView.dailyMentionTrend.reduce((sum, d) => sum + d.count, 0);
  const mentionsAfter = after.macroView.dailyMentionTrend.reduce((sum, d) => sum + d.count, 0);
  const mentionsDelta = mentionsAfter - mentionsBefore;
  const mentionsDeltaPercent =
    mentionsBefore === 0 ? (mentionsAfter > 0 ? 100 : 0) : (mentionsDelta / mentionsBefore) * 100;

  // 3. 키워드 변화 분석
  const beforeKeywordMap = new Map<string, number>();
  for (const kw of before.sentimentFraming.topKeywords) {
    beforeKeywordMap.set(kw.keyword, kw.count);
  }

  const afterKeywordMap = new Map<string, number>();
  for (const kw of after.sentimentFraming.topKeywords) {
    afterKeywordMap.set(kw.keyword, kw.count);
  }

  const beforeKeywordSet = new Set(beforeKeywordMap.keys());
  const afterKeywordSet = new Set(afterKeywordMap.keys());

  // 새로 등장한 키워드 (이전에 없었던 것)
  const appeared: string[] = [];
  for (const kw of afterKeywordSet) {
    if (!beforeKeywordSet.has(kw)) {
      appeared.push(kw);
    }
  }

  // 사라진 키워드 (이후에 없는 것)
  const disappeared: string[] = [];
  for (const kw of beforeKeywordSet) {
    if (!afterKeywordSet.has(kw)) {
      disappeared.push(kw);
    }
  }

  // 공통 키워드 중 상승/하락
  const rising: Array<{ keyword: string; beforeCount: number; afterCount: number }> = [];
  const declining: Array<{ keyword: string; beforeCount: number; afterCount: number }> = [];

  for (const kw of afterKeywordSet) {
    if (beforeKeywordSet.has(kw)) {
      const beforeCount = beforeKeywordMap.get(kw) ?? 0;
      const afterCount = afterKeywordMap.get(kw) ?? 0;
      if (afterCount > beforeCount) {
        rising.push({ keyword: kw, beforeCount, afterCount });
      } else if (afterCount < beforeCount) {
        declining.push({ keyword: kw, beforeCount, afterCount });
      }
    }
  }

  // 상승폭/하락폭 기준 정렬
  rising.sort((a, b) => b.afterCount - b.beforeCount - (a.afterCount - a.beforeCount));
  declining.sort((a, b) => a.afterCount - a.beforeCount - (b.afterCount - b.beforeCount));

  // 4. overallDirection 변화
  const overallDirection = {
    before: before.macroView.overallDirection,
    after: after.macroView.overallDirection,
  };

  return {
    sentiment: {
      before: sentimentBefore,
      after: sentimentAfter,
      delta: sentimentDelta,
    },
    mentions: {
      before: mentionsBefore,
      after: mentionsAfter,
      delta: mentionsDelta,
      deltaPercent: Math.round(mentionsDeltaPercent * 10) / 10,
    },
    keywords: {
      appeared,
      disappeared,
      rising,
      declining,
    },
    overallDirection,
    collectionStats,
  };
}
