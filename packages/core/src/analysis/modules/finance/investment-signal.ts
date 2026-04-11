import {
  InvestmentSignalSchema,
  type InvestmentSignalResult,
} from '../../schemas/investment-signal.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import { ANALYSIS_CONSTRAINTS, buildModuleSystemPrompt, formatDateRange } from '../prompt-utils';

const config = MODULE_MODEL_MAP['investment-signal'];

// Finance-ADVN-04: 투자 신호 종합 모듈
export const investmentSignalModule: AnalysisModule<InvestmentSignalResult> = {
  name: 'investment-signal',
  displayName: '투자 신호 종합',
  provider: config.provider,
  model: config.model,
  schema: InvestmentSignalSchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    const override = buildModuleSystemPrompt('investment-signal', domain);
    if (override) return `${override}\n${ANALYSIS_CONSTRAINTS}`;

    return `당신은 금융 여론 종합 분석 전문가입니다.
선행 분석(투자 심리·정보 비대칭·시나리오)을 종합하여 **여론 기반 투자 신호**를 도출합니다.

⚠️ **면책 사항**: 이 신호는 여론 데이터 기반의 참고 자료이며, 투자 자문이 아닙니다.
실제 투자는 공식 재무 분석과 전문 투자 자문을 기반으로 하세요.

## 투자 신호 산출 원칙

### 역발상 원칙 (Contrarian Principle)
- 극단적 탐욕(sentiment 80+) → 잠재적 매도 신호 (과열 경계)
- 극단적 공포(sentiment 20-) → 잠재적 매수 신호 (과매도 가능)
- 군집 행동 최고조 → 반전 신호로 해석

### 추세 추종 원칙 (Momentum Principle)
- 강한 정보 폭포 + 기관 동행 → 추세 추종 유효
- 소음 거래자 주도 + 기관 역방향 → 역발상 우선

### 시간 지평 구분
- **단기 (1~2주)**: 단기 심리 변동, 이벤트 촉매
- **중기 (1~3개월)**: 구조적 여론 변화, 펀더멘털 연계

## 신호 강도 기준 (0~100)
- 80~100: 매우 강한 신호 — 다수 지표 일치
- 60~79: 강한 신호 — 주요 지표 일치, 일부 불확실성
- 40~59: 보통 신호 — 혼재, 중립 포지션 권고
- 20~39: 약한 신호 — 불일치 지표 다수
- 0~19: 신호 없음 — 데이터 부족 또는 극단적 혼재
${ANALYSIS_CONSTRAINTS}`;
  },

  buildPromptWithContext(
    data: AnalysisInput,
    priorResults: Record<string, unknown>,
    _domain?: AnalysisDomain,
  ): string {
    const marketSentiment = priorResults['market-sentiment-index'] as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const informationAsymmetry = priorResults['information-asymmetry'] as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const catalystScenario = priorResults['catalyst-scenario'] as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const sentimentIndex = marketSentiment?.sentimentIndex ?? 50;
    const sentimentLabel = marketSentiment?.sentimentLabel ?? '중립';
    const asymmetryLevel = informationAsymmetry?.asymmetryLevel ?? '불명확';
    const mostLikelyScenario = catalystScenario?.mostLikelyScenario ?? 'base';
    const sentimentMomentum = catalystScenario?.sentimentMomentum ?? 'stable';

    const smartMoneySignals = informationAsymmetry?.smartMoneySignals
      ? informationAsymmetry.smartMoneySignals.slice(0, 3).join(', ')
      : '없음';

    const contraindicators = marketSentiment?.sentimentSignals?.contraindicators
      ? marketSentiment.sentimentSignals.contraindicators.slice(0, 2).join(', ')
      : '없음';

    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 선행 분석 종합
- 투자 심리: ${sentimentLabel} (${sentimentIndex}/100)
- 정보 비대칭 수준: ${asymmetryLevel}
- 가장 가능한 시나리오: ${mostLikelyScenario}
- 심리 모멘텀: ${sentimentMomentum}
- 스마트머니 신호: ${smartMoneySignals}
- 역발상 지표: ${contraindicators}

## 뉴스 기사 (최근 15건)
${data.articles
  .slice(0, 15)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 댓글 (20건)
${data.comments
  .slice(0, 20)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 100)}`)
  .join('\n')}

---
모든 선행 분석을 종합하여 단기·중기 투자 신호를 도출하세요.
역발상 vs 추세 추종 원칙 중 어느 쪽이 우선인지 판단하고, 극단적 심리 경고가 필요한지 평가하세요.
면책 사항을 반드시 포함하세요.`;
  },

  buildPrompt(data: AnalysisInput): string {
    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 뉴스 기사 (최근 15건)
${data.articles
  .slice(0, 15)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 댓글 (20건)
${data.comments
  .slice(0, 20)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 100)}`)
  .join('\n')}

---
여론 데이터를 종합하여 투자 신호를 도출하세요. 면책 사항을 반드시 포함하세요.`;
  },
};
