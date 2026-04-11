import {
  CatalystScenarioSchema,
  type CatalystScenarioResult,
} from '../../schemas/catalyst-scenario.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import { ANALYSIS_CONSTRAINTS, buildModuleSystemPrompt, formatDateRange } from '../prompt-utils';

const config = MODULE_MODEL_MAP['catalyst-scenario'];

// Finance-ADVN-03: 호재/악재 시나리오 모듈
export const catalystScenarioModule: AnalysisModule<CatalystScenarioResult> = {
  name: 'catalyst-scenario',
  displayName: '시장 시나리오 분석',
  provider: config.provider,
  model: config.model,
  schema: CatalystScenarioSchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    const override = buildModuleSystemPrompt('catalyst-scenario', domain);
    if (override) return `${override}\n${ANALYSIS_CONSTRAINTS}`;

    return `당신은 시장 시나리오 플래닝 전문가입니다.
**Noise Trader Theory (De Long et al., 1990)**와 현재 여론 데이터를 결합하여 3가지 시나리오를 구성합니다.

⚠️ 면책 사항: 이 시나리오는 투자 자문이 아닙니다.

## 3개 시나리오 (순서 고정: bull/base/bear)

### Bull (강세/호재) 시나리오
- 현재 긍정 신호가 현실화되는 경우
- 소음 거래자(Noise Trader)의 과잉 낙관이 단기 추가 상승을 만드는 메커니즘
- 강세 내러티브가 확산되는 촉발 이벤트 목록

### Base (기본) 시나리오
- 현재 상태가 유지되거나 점진적 변화
- 가장 가능성 높은 시나리오
- 강세/약세 요인이 균형을 이루는 상태

### Bear (약세/악재) 시나리오
- 현재 부정 신호가 현실화되는 경우
- 소음 거래자의 패닉이 과도한 매도를 촉발하는 메커니즘
- 약세 내러티브가 확산되는 촉발 이벤트 목록

## 노이즈 vs 시그널 구분
- **노이즈**: 단기 과잉반응으로 되돌아올 가능성이 높은 여론 변화
- **시그널**: 펀더멘털 변화를 반영하는 구조적 여론 변화
${ANALYSIS_CONSTRAINTS}`;
  },

  buildPromptWithContext(
    data: AnalysisInput,
    priorResults: Record<string, unknown>,
    _domain?: AnalysisDomain,
  ): string {
    const marketSentiment = priorResults['market-sentiment-index'] as Record<string, unknown>;
    const informationAsymmetry = priorResults['information-asymmetry'] as Record<string, unknown>;
    const riskMap = priorResults['risk-map'] as Record<string, unknown>;

    const sentimentIndex = marketSentiment?.sentimentIndex ?? 50;
    const sentimentLabel = marketSentiment?.sentimentLabel ?? '중립';

    const leadingIndicators = informationAsymmetry?.leadingIndicators
      ? informationAsymmetry.leadingIndicators
          .slice(0, 3)
          .map((i: Record<string, unknown>) => `- ${i.indicator} (${i.significance})`)
          .join('\n')
      : '';

    const topRisks = riskMap?.topRisks
      ? riskMap.topRisks
          .slice(0, 2)
          .map((r: Record<string, unknown>) => `- ${r.title}`)
          .join('\n')
      : '';

    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 현재 투자 심리: ${sentimentLabel} (지수: ${sentimentIndex}/100)

## 선행 지표:
${leadingIndicators || '없음'}

## 주요 리스크:
${topRisks || '없음'}

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
bull/base/bear 3개 시나리오를 구성하고 각각의 촉발 이벤트·발생 확률·심리 영향을 도출하세요.
현재 여론이 노이즈인지 시그널인지 판단을 포함하세요. 면책 사항을 반드시 포함하세요.`;
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
bull/base/bear 3개 시나리오를 구성하세요. 면책 사항을 포함하세요.`;
  },
};
