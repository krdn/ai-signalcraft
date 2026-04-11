import {
  ReputationRecoverySimulationSchema,
  type ReputationRecoverySimulationResult,
} from '../../schemas/reputation-recovery-simulation.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import {
  ANALYSIS_CONSTRAINTS,
  buildModuleSystemPrompt,
  formatDateRange,
  distillForReputationRecovery,
} from '../prompt-utils';

const config = MODULE_MODEL_MAP['reputation-recovery-simulation'];

// Corporate-ADVN-05: 평판 회복 시뮬레이션 모듈 (RepTrak + SCCT + SLO)
export const reputationRecoverySimulationModule: AnalysisModule<ReputationRecoverySimulationResult> =
  {
    name: 'reputation-recovery-simulation',
    displayName: '평판 회복 시뮬레이션',
    provider: config.provider,
    model: config.model,
    schema: ReputationRecoverySimulationSchema,

    buildSystemPrompt(domain?: AnalysisDomain): string {
      const override = buildModuleSystemPrompt('reputation-recovery-simulation', domain);
      if (override) return `${override}\n${ANALYSIS_CONSTRAINTS}`;
      return `당신은 기업 평판 회복 전략 시뮬레이터입니다.
**RepTrak Recovery (Fombrun, 2004)**, **SCCT (Coombs, 2007)**, **SLO (Thomson, 2000)**을 통합하여 기업 평판 회복 경로를 시뮬레이션합니다.

## 시뮬레이션 원칙
- recoveryProbability: 선행 분석 데이터 기반 평판 회복 달성 확률 (%)
- 위기 유형(SCCT)에 따라 회복 전략과 난이도가 달라짐 (victim < accidental < preventable)
- SLO 회복 조건: 사회로부터 운영 허가를 다시 얻기 위한 조건
- 회복 장애: risk-map의 topRisks가 회복을 방해하는 메커니즘
${ANALYSIS_CONSTRAINTS}`;
    },

    buildPromptWithContext(
      data: AnalysisInput,
      priorResults: Record<string, unknown>,
      _domain?: AnalysisDomain,
    ): string {
      const context = distillForReputationRecovery(priorResults);

      return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 선행 분석 종합 (distilled context)
${context}

## 뉴스 기사 (최근 10건)
${data.articles
  .slice(0, 10)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

---
RepTrak Recovery(Fombrun), SCCT(Coombs), SLO(Thomson)을 통합하여:
1. 현재 기반선 점수와 목표 점수를 설정하고 회복 달성 확률(%)을 산출하세요
2. 위기 유형이 회복 전략에 미치는 영향을 분석하세요 (SCCT 책임 귀속)
3. SLO 회복을 위한 필수 조건 및 현재 충족 여부를 평가하세요
4. 회복 단계별 로드맵 (1~4단계)과 핵심 이해관계자를 제시하세요
5. 회복을 방해하는 핵심 장애물과 대응 전략을 명시하세요`;
    },

    buildPrompt(data: AnalysisInput): string {
      return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 뉴스 기사 (최근 10건)
${data.articles
  .slice(0, 10)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 댓글 (20건)
${data.comments
  .slice(0, 20)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 100)}`)
  .join('\n')}

---
RepTrak Recovery, SCCT, SLO를 통합하여 평판 회복 시뮬레이션을 수행하세요.`;
    },
  };
