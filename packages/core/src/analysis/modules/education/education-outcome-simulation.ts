import {
  EducationOutcomeSimulationSchema,
  type EducationOutcomeSimulationResult,
} from '../../schemas/education-outcome-simulation.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import { ANALYSIS_CONSTRAINTS, buildModuleSystemPrompt, formatDateRange } from '../prompt-utils';

const config = MODULE_MODEL_MAP['education-outcome-simulation'];

// Education-ADVN-04: 교육기관 목표 달성 시뮬레이션 모듈
// Rankings Dynamics(Espeland & Sauder, 2007) + Institutional Reputation Theory(Fombrun, 1996)
export const educationOutcomeSimulationModule: AnalysisModule<EducationOutcomeSimulationResult> = {
  name: 'education-outcome-simulation',
  displayName: '교육기관 목표 달성 시뮬레이션',
  provider: config.provider,
  model: config.model,
  schema: EducationOutcomeSimulationSchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    const override = buildModuleSystemPrompt('education-outcome-simulation', domain);
    if (override) return `${override}\n${ANALYSIS_CONSTRAINTS}`;

    return `당신은 교육기관 평판 회복 시뮬레이션 전문가입니다.
**Rankings Dynamics (Espeland & Sauder, 2007)**와 **Institutional Reputation Theory (Fombrun, 1996)**를 종합하여 교육기관 신뢰 회복 확률과 최적 전략을 도출합니다.

## 시뮬레이션 프레임워크 (교육기관 도메인)
- **recoveryProbability**: '선거 승리'가 아닌 **'교육기관 신뢰 회복 및 평판 목표 달성 확률'**
  - 기관 만족도(재학생·학부모) 회복, 입학 지원자 수 목표 달성, 언론 프레임 중립화
- **institutional-reputation-index**의 현재 평판 지수를 기반선으로 활용
- **education-opinion-frame**의 프레임 전환 가능성을 가점 요인으로 반영
- **education-crisis-scenario**의 시나리오 실현 가능성을 확률 조정 요인으로 반영

## 목표 달성 조건 (교육기관 도메인)
- 재학생·학부모 만족도 목표치 회복 (met/partial/unmet)
- 언론·미디어 프레임 중립화 이상 달성
- 고용주 및 잠재 입학 희망자 신뢰 회복
- 학사 비리·이슈의 공식 해결과 재발 방지 조치 공표
- 경쟁 교육기관 대비 포지셔닝 개선

## strategy 모듈과의 차별화
- strategy의 전략을 반복하지 말고, 시뮬레이션 결과로 **전략 우선순위 재배치**
- expectedImpact: 정량적 표현 필수 (예: "입학 지원자 수 10% 회복 기대", "재학생 만족도 5p 상승")
- 낙관/비관 시나리오별 확률과 핵심 변수를 분리 제시
${ANALYSIS_CONSTRAINTS}`;
  },

  buildPromptWithContext(
    data: AnalysisInput,
    priorResults: Record<string, unknown>,
    _domain?: AnalysisDomain,
  ): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reputationIndex = priorResults['institutional-reputation-index'] as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opinionFrame = priorResults['education-opinion-frame'] as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const crisisScenario = priorResults['education-crisis-scenario'] as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const strategy = priorResults['strategy'] as any;

    const reputationScore = reputationIndex?.reputationIndex ?? 50;
    const reputationTrend = reputationIndex?.trend ?? 'stable';
    const signalingGaps = (reputationIndex?.signalingGaps ?? []) as { gap?: string }[];

    const frameDynamics = opinionFrame?.frameDynamics?.currentBalance ?? '불명확';
    const turningConditions = (opinionFrame?.frameDynamics?.turningConditions ?? []) as string[];

    const spreadProbability =
      (crisisScenario?.scenarios as { type: string; probability: number }[] | undefined)?.find(
        (s) => s.type === 'spread',
      )?.probability ?? '불명확';

    const strategyActions = strategy?.shortTermActions
      ? (strategy.shortTermActions as { action: string }[])
          .slice(0, 3)
          .map((a) => `- ${a.action}`)
          .join('\n')
      : '';

    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 선행 분석 종합
- 현재 기관 평판 지수: ${reputationScore}/100, 추세: ${reputationTrend}
- 신호-수신 간극: ${signalingGaps.length}개
- 현재 프레임 균형: ${frameDynamics}
- 프레임 전환 트리거: ${turningConditions.slice(0, 2).join(', ') || '식별 안 됨'}
- 위기 확산 확률(worst case): ${spreadProbability}%
- 현재 전략 방향:\n${strategyActions}

## 뉴스 기사 (최근 15건)
${data.articles
  .slice(0, 15)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

---
위 선행 분석을 종합하여 교육기관 신뢰 회복 확률(0~100%)을 산출하세요.
strategy 모듈 전략을 반복하지 말고, 시뮬레이션 결과를 기반으로 전략 우선순위를 재배치하세요.
모든 expectedImpact는 정량적으로 표현하세요 (예: "입학 지원자 10% 회복", "재학생 만족도 5p 상승").
낙관/비관 시나리오별 확률을 별도로 제시하세요.`;
  },

  buildPrompt(data: AnalysisInput): string {
    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 뉴스 기사 (최근 15건)
${data.articles
  .slice(0, 15)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

---
교육기관 신뢰 회복 확률(0~100%)과 최적 전략 우선순위를 시뮬레이션하세요.`;
  },
};
