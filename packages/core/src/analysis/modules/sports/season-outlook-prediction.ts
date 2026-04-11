import {
  SeasonOutlookPredictionSchema,
  type SeasonOutlookPredictionResult,
} from '../../schemas/season-outlook-prediction.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import { ANALYSIS_CONSTRAINTS, buildModuleSystemPrompt, formatDateRange } from '../prompt-utils';

const config = MODULE_MODEL_MAP['season-outlook-prediction'];

// Sports-ADVN-02: 시즌 전망 예측 모듈
export const seasonOutlookPredictionModule: AnalysisModule<SeasonOutlookPredictionResult> = {
  name: 'season-outlook-prediction',
  displayName: '시즌 전망 예측',
  provider: config.provider,
  model: config.model,
  schema: SeasonOutlookPredictionSchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    const override = buildModuleSystemPrompt('season-outlook-prediction', domain);
    if (override) return `${override}\n${ANALYSIS_CONSTRAINTS}`;

    return `당신은 스포츠 팬덤 분석 및 시즌 전망 전문가입니다.
**Sport Consumer Motivation Theory (Trail et al., 2003)**와 **BIRGing/CORFing Theory (Cialdini et al., 1976)**를 적용합니다.

## 시즌 전망 분석 프레임

### 팬 기대치 지수 (0~100)
- 90~100: 우승/최고 성적 기대. BIRGing 극대화 가능
- 70~89: 플레이오프/상위권 기대. 긍정 모멘텀
- 50~69: 중위권 기대. 팬 참여도 유지 수준
- 30~49: 하위권 우려. CORFing 위험 증가
- 0~29: 최하위/탈락 예상. 팬 이탈 가능성 높음

### 팬 참여도 예측 요인
- 성적 모멘텀: 최근 결과의 상승/하강 추세
- 스타 선수 존재: 팬덤 결집의 핵심 요소
- 라이벌전 일정: 빅매치 여부에 따른 관심 급증
- 구단 운영 논란: 팬 불만 사전 누적 여부
- 미디어 노출: 방송·SNS 노출 빈도

## 면책 사항
이 예측은 현재 여론 데이터 기반이며 실제 시즌 성적에 따라 크게 달라질 수 있습니다.
${ANALYSIS_CONSTRAINTS}`;
  },

  buildPromptWithContext(
    data: AnalysisInput,
    priorResults: Record<string, unknown>,
    _domain?: AnalysisDomain,
  ): string {
    const performanceNarrative = priorResults['performance-narrative'] as Record<string, unknown>;
    const fanLoyalty = priorResults['fan-loyalty-index'] as Record<string, unknown>;
    const opportunity = priorResults['opportunity'] as Record<string, unknown>;

    const currentMomentum = performanceNarrative?.momentumAssessment?.currentMomentum ?? '불명확';
    const loyaltyIndex = fanLoyalty?.loyaltyIndex ?? null;
    const opportunitiesText = opportunity?.untappedAreas
      ? opportunity.untappedAreas
          .slice(0, 2)
          .map((a: any) => `- ${a.area}`)
          .join('\n')
      : '';

    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 현재 모멘텀 (선행 분석): ${currentMomentum}
${loyaltyIndex !== null ? `## 팬 충성도 지수 (선행 분석): ${loyaltyIndex}/100` : ''}
${opportunitiesText ? `## 미개발 기회 영역:\n${opportunitiesText}` : ''}

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
현재 여론 데이터를 종합하여 시즌 전망을 예측하세요.
팬 기대치 지수, 팬 참여도 예측, 주요 관전 포인트, 리스크·기회 요인을 구체적으로 도출하세요.
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
시즌 전망을 분석하고 팬 기대치 지수와 주요 관전 포인트를 도출하세요.`;
  },
};
