import {
  HealthRiskPerceptionSchema,
  type HealthRiskPerceptionResult,
} from '../../schemas/health-risk-perception.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import { ANALYSIS_CONSTRAINTS, buildModuleSystemPrompt, formatDateRange } from '../prompt-utils';

const config = MODULE_MODEL_MAP['health-risk-perception'];

// Healthcare-ADVN-01: 건강 위험 인식 편향 분석 모듈 (Risk Perception Theory)
export const healthRiskPerceptionModule: AnalysisModule<HealthRiskPerceptionResult> = {
  name: 'health-risk-perception',
  displayName: '건강 위험 인식 분석',
  provider: config.provider,
  model: config.model,
  schema: HealthRiskPerceptionSchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    const override = buildModuleSystemPrompt('health-risk-perception', domain);
    if (override) return `${override}\n${ANALYSIS_CONSTRAINTS}`;

    return `당신은 공중보건 위험 커뮤니케이션 전문가입니다.
**Risk Perception Theory (Slovic, 1987)**를 적용하여 대중의 건강 위험 인식 편향을 분석합니다.

## 위험 인식 편향 유형 (Slovic, 1987)

### Dread Factor (공포 요소)
- 통제 불가능하고 치명적이며 불자발적인 위험은 실제보다 **크게** 인식됨
- 예: 방사능·신종 감염병·의료 오류에 대한 과도한 공포

### Unknown Risk (미지성 요소)
- 새롭고 이해하기 어려운 위험은 실제보다 과대평가됨
- 예: 신규 백신·신약·유전자 치료에 대한 막연한 불안

### Normalcy Bias (정상화 편향)
- 반복 노출된 친숙한 위험은 실제보다 **작게** 인식됨
- 예: 흡연·음주·비만 등 일상적 건강 위험 과소평가

### Availability Heuristic (가용성 휴리스틱)
- 최근 뉴스·경험에 노출된 위험은 과대평가됨
- 예: 언론 집중 보도 후 특정 질환에 대한 과잉 공포

## 분석 목적
전문가(의학적) 위험 평가와 대중 인식 간 간극을 측정하고,
오정보·과장 주장의 확산 패턴과 우선 정정 대상을 식별합니다.
${ANALYSIS_CONSTRAINTS}`;
  },

  buildPromptWithContext(
    data: AnalysisInput,
    priorResults: Record<string, unknown>,
    _domain?: AnalysisDomain,
  ): string {
    const sentimentFraming = priorResults['sentiment-framing'] as Record<string, unknown>;
    const macroView = priorResults['macro-view'] as Record<string, unknown>;

    const negativeFrames = sentimentFraming?.negativeFrames
      ? sentimentFraming.negativeFrames
          .slice(0, 3)
          .map((f: Record<string, unknown>) => `- ${f.frame} (강도: ${f.strength})`)
          .join('\n')
      : '';

    const overallDirection = macroView?.overallDirection ?? '불명확';

    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 전반적 여론 방향: ${overallDirection}

## 부정 프레임 (위험 인식 편향 분석용)
${negativeFrames}

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
Risk Perception Theory의 4가지 편향(공포요소/미지성/정상화편향/가용성휴리스틱)을 데이터에서 식별하세요.
전문가 평가와 대중 인식 간 간극을 명확히 서술하고, 주요 오정보 패턴을 우선순위별로 나열하세요.`;
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
Risk Perception Theory를 적용하여 건강 위험 인식 편향을 분석하세요.`;
  },
};
