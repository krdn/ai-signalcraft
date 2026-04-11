import {
  CompliancePredictorSchema,
  type CompliancePredictorResult,
} from '../../schemas/compliance-predictor.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import { ANALYSIS_CONSTRAINTS, buildModuleSystemPrompt, formatDateRange } from '../prompt-utils';

const config = MODULE_MODEL_MAP['compliance-predictor'];

// Healthcare-ADVN-02: 의료 순응도 예측 모듈 (Health Belief Model)
export const compliancePredictorModule: AnalysisModule<CompliancePredictorResult> = {
  name: 'compliance-predictor',
  displayName: '의료 순응도 예측',
  provider: config.provider,
  model: config.model,
  schema: CompliancePredictorSchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    const override = buildModuleSystemPrompt('compliance-predictor', domain);
    if (override) return `${override}\n${ANALYSIS_CONSTRAINTS}`;

    return `당신은 건강 행동 예측 전문가입니다.
**Health Belief Model (HBM, Rosenstock 1966)**을 적용하여 의료 순응도를 예측합니다.

## HBM 6가지 결정 요인

| 요인 | 설명 | 여론 데이터에서의 신호 |
|------|------|---------------------|
| **인지된 취약성** | "나도 걸릴 수 있다"는 인식 | "나도 걱정이다", 자가 진단 문의 댓글 |
| **인지된 심각성** | 질환/위험의 심각도 인식 | 위중증·사망 사례 언급 빈도 |
| **인지된 이익** | 치료/예방의 효과 기대 | "효과 있다", 치료 성공 사례 공유 |
| **인지된 장벽** | 치료/예방의 방해 요인 | "비싸다", "부작용이 걱정", "시간이 없다" |
| **행동 유발 계기** | 의사 권고·미디어·주변 권유 | 전문가 조언 공유, 캠페인 언급 |
| **자기효능감** | "내가 할 수 있다"는 믿음 | "나도 해봤다", 실천 후기 |

## Theory of Planned Behavior 연계 (Ajzen, 1991)
- 태도(attitude): 건강 행동에 대한 긍정/부정적 평가
- 주관적 규범(subjective norm): 주변 사람들의 기대에 대한 인식
- 지각된 행동 통제(perceived behavioral control): 실천 가능성 인식
${ANALYSIS_CONSTRAINTS}`;
  },

  buildPromptWithContext(
    data: AnalysisInput,
    priorResults: Record<string, unknown>,
    _domain?: AnalysisDomain,
  ): string {
    const healthRiskPerception = priorResults['health-risk-perception'] as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const segmentation = priorResults['segmentation'] as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const perceivedRiskLevel = healthRiskPerception?.perceivedRiskLevel ?? '데이터 없음';
    const groups = segmentation?.audienceGroups
      ? segmentation.audienceGroups
          .map((g: Record<string, unknown>) => `- ${g.groupName}: ${g.sentiment}`)
          .join('\n')
      : '';

    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 위험 인식 수준 (선행 분석): ${perceivedRiskLevel}

## 집단별 감정 (선행 분석)
${groups}

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
HBM 6요인 각각에 대한 여론 데이터 근거를 식별하고, 집단별 의료 순응 예측 확률을 도출하세요.
장벽이 가장 큰 요인과 이를 낮출 개입 전략을 우선순위와 함께 제시하세요.`;
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
HBM 6요인을 여론 데이터에서 식별하고 의료 순응도를 예측하세요.`;
  },
};
