import {
  MarketSentimentIndexSchema,
  type MarketSentimentIndexResult,
} from '../../schemas/market-sentiment-index.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import { ANALYSIS_CONSTRAINTS, buildModuleSystemPrompt, formatDateRange } from '../prompt-utils';

const config = MODULE_MODEL_MAP['market-sentiment-index'];

// Finance-ADVN-01: 투자 심리 지수 모듈 (Baker & Wurgler, 2006)
export const marketSentimentIndexModule: AnalysisModule<MarketSentimentIndexResult> = {
  name: 'market-sentiment-index',
  displayName: '투자 심리 지수',
  provider: config.provider,
  model: config.model,
  schema: MarketSentimentIndexSchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    const override = buildModuleSystemPrompt('market-sentiment-index', domain);
    if (override) return `${override}\n${ANALYSIS_CONSTRAINTS}`;

    return `당신은 투자자 심리 및 행동 재무학 분석 전문가입니다.
**Investor Sentiment Index (Baker & Wurgler, 2006)**와 **Behavioral Finance Theory (Kahneman & Tversky, 1979)**를 적용합니다.

⚠️ **면책 사항**: 이 분석은 투자 자문이 아닙니다. 시장 심리 연구 목적의 여론 분석 참고 자료입니다.

## 투자 심리 지수 기준 (0~100)

| 범위 | 레이블 | 역발상 신호 |
|------|--------|-----------|
| 0~20 | 극단적 공포 (Extreme Fear) | 역발상 매수 신호 가능 |
| 21~40 | 공포 (Fear) | 조심스러운 매수 고려 |
| 41~60 | 중립 (Neutral) | 추세 추종 유지 |
| 61~80 | 탐욕 (Greed) | 리스크 관리 강화 |
| 81~100 | 극단적 탐욕 (Extreme Greed) | 역발상 매도 신호 가능 |

## 행동 재무학 편향 식별 기준 (Kahneman & Tversky)
- **손실 회피 (Loss Aversion)**: 손실 두려움이 이익 기대보다 2~3배 강한 반응
- **앵커링 편향 (Anchoring)**: 특정 가격·수치에 집착하는 댓글 패턴
- **군집 행동 (Herding)**: "다들 산다/판다"는 집단 행동 언급
- **확증 편향 (Confirmation Bias)**: 기존 포지션 지지 정보만 선택적으로 공유
- **과신 편향 (Overconfidence)**: "반드시 오른다/내린다" 확신 표현
${ANALYSIS_CONSTRAINTS}`;
  },

  buildPromptWithContext(
    data: AnalysisInput,
    priorResults: Record<string, unknown>,
    _domain?: AnalysisDomain,
  ): string {
    const sentimentFraming = priorResults['sentiment-framing'] as Record<string, unknown>;
    const macroView = priorResults['macro-view'] as Record<string, unknown>;
    const segmentation = priorResults['segmentation'] as Record<string, unknown>;

    const sentimentRatio = sentimentFraming?.sentimentRatio
      ? `긍정 ${Math.round((sentimentFraming.sentimentRatio.positive ?? 0) * 100)}% / 부정 ${Math.round((sentimentFraming.sentimentRatio.negative ?? 0) * 100)}% / 중립 ${Math.round((sentimentFraming.sentimentRatio.neutral ?? 0) * 100)}%`
      : '데이터 없음';

    const overallDirection = macroView?.overallDirection ?? '불명확';

    const audienceGroups = segmentation?.audienceGroups
      ? segmentation.audienceGroups
          .map((g: Record<string, unknown>) => `- ${g.groupName} [${g.type}]: ${g.sentiment}`)
          .join('\n')
      : '';

    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 선행 분석 요약
- 전반적 여론 방향: ${overallDirection}
- 감정 비율: ${sentimentRatio}
- 투자자 집단별 반응:\n${audienceGroups}

## 뉴스 기사 (최근 20건)
${data.articles
  .slice(0, 20)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 댓글 (30건 — 투자자 심리 신호 포함)
${data.comments
  .slice(0, 30)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 120)}`)
  .join('\n')}

---
Baker & Wurgler(2006) 투자자 심리 지수를 0~100으로 산출하고,
Kahneman & Tversky의 행동 재무학 편향 패턴을 데이터에서 구체적으로 식별하세요.
면책 사항을 반드시 포함하세요.`;
  },

  buildPrompt(data: AnalysisInput): string {
    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 뉴스 기사 (최근 20건)
${data.articles
  .slice(0, 20)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 댓글 (30건)
${data.comments
  .slice(0, 30)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 120)}`)
  .join('\n')}

---
투자 심리 지수를 산출하고 행동 재무학 편향 패턴을 식별하세요. 면책 사항을 포함하세요.`;
  },
};
