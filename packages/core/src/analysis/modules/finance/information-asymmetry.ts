import {
  InformationAsymmetrySchema,
  type InformationAsymmetryResult,
} from '../../schemas/information-asymmetry.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import { ANALYSIS_CONSTRAINTS, buildModuleSystemPrompt, formatDateRange } from '../prompt-utils';

const config = MODULE_MODEL_MAP['information-asymmetry'];

// Finance-ADVN-02: 정보 비대칭 분석 모듈 (Information Cascade Theory)
export const informationAsymmetryModule: AnalysisModule<InformationAsymmetryResult> = {
  name: 'information-asymmetry',
  displayName: '정보 비대칭 분석',
  provider: config.provider,
  model: config.model,
  schema: InformationAsymmetrySchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    const override = buildModuleSystemPrompt('information-asymmetry', domain);
    if (override) return `${override}\n${ANALYSIS_CONSTRAINTS}`;

    return `당신은 금융 정보 흐름 및 시장 미시구조 분석 전문가입니다.
**Information Cascade Theory (Bikhchandani, Hirshleifer & Welch, 1992)**와 **Noise Trader Theory (De Long et al., 1990)**를 적용합니다.

⚠️ 면책 사항: 이 분석은 투자 자문이 아닙니다.

## 정보 폭포 (Information Cascade) 식별 기준
정보 폭포는 개인이 자신의 사적 정보 대신 다른 사람의 행동을 따라갈 때 발생합니다.

**신호**:
- 초기 소수 의견이 급격히 다수의 모방 행동으로 이어지는 패턴
- 특정 플랫폼(예: 주식 갤러리)에서 시작하여 투자 커뮤니티로 확산
- 근거 없이 "다들 한다"는 군중 심리 표현 급증

## 선행 지표 (Leading Indicator) 식별
주류 미디어·시장 가격에 반영되기 **전**에 온라인 커뮤니티에 먼저 나타나는 신호:
- 내부자 연관 계정의 이례적 발언
- 특정 종목 관련 질문 급증
- 루머 형태의 정보 공유

## 정보 공백 (Information Vacuum)
공식 정보가 없는 영역을 소문·루머가 채우는 현상:
- 공시 전 기간의 추측 난무
- CEO/임원 관련 근거 없는 주장
- 재무 데이터 발표 전 과도한 예측
${ANALYSIS_CONSTRAINTS}`;
  },

  buildPromptWithContext(
    data: AnalysisInput,
    priorResults: Record<string, unknown>,
    _domain?: AnalysisDomain,
  ): string {
    const macroView = priorResults['macro-view'] as Record<string, unknown>;
    const marketSentiment = priorResults['market-sentiment-index'] as Record<string, unknown>;

    const inflectionPoints = macroView?.inflectionPoints
      ? macroView.inflectionPoints
          .slice(0, 3)
          .map((p: Record<string, unknown>) => `- ${p.date}: ${p.description}`)
          .join('\n')
      : '';

    const sentimentLabel = marketSentiment?.sentimentLabel ?? '불명확';
    const biases = marketSentiment?.behavioralBiases
      ? marketSentiment.behavioralBiases
          .slice(0, 2)
          .map((b: Record<string, unknown>) => `- ${b.biasName}`)
          .join('\n')
      : '';

    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 주요 변곡점 (선행 분석)
${inflectionPoints || '없음'}

## 현재 투자 심리 레이블: ${sentimentLabel}
${biases ? `## 식별된 편향:\n${biases}` : ''}

## 뉴스 기사 (최근 20건)
${data.articles
  .slice(0, 20)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 댓글 (30건 — 정보 흐름 신호 포함)
${data.comments
  .slice(0, 30)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 120)}`)
  .join('\n')}

---
Information Cascade Theory를 적용하여 정보 폭포 현상과 선행 지표를 식별하세요.
정보 공백 영역과 루머 위험을 파악하고, 기관 투자자의 역방향 행동 신호를 포착하세요.`;
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
Information Cascade Theory를 적용하여 정보 비대칭과 선행 지표를 분석하세요.`;
  },
};
