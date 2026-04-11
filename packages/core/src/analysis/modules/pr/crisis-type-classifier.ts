import {
  CrisisTypeClassifierSchema,
  type CrisisTypeClassifierResult,
} from '../../schemas/crisis-type-classifier.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import { ANALYSIS_CONSTRAINTS, buildModuleSystemPrompt, formatDateRange } from '../prompt-utils';

const config = MODULE_MODEL_MAP['crisis-type-classifier'];

// PR-ADVN-01: SCCT 기반 위기 유형 분류 및 대응 전략 매핑 모듈
export const crisisTypeClassifierModule: AnalysisModule<CrisisTypeClassifierResult> = {
  name: 'crisis-type-classifier',
  displayName: 'SCCT 위기 유형 분류',
  provider: config.provider,
  model: config.model,
  schema: CrisisTypeClassifierSchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    const override = buildModuleSystemPrompt('crisis-type-classifier', domain);
    if (override) return `${override}\n${ANALYSIS_CONSTRAINTS}`;

    return `당신은 위기 커뮤니케이션 전문가입니다.
**Situational Crisis Communication Theory (SCCT, Coombs 2007)**를 적용하여 위기 유형을 분류하고 최적 대응 전략을 매핑합니다.

## SCCT 위기 유형 분류 기준

| 유형 | 설명 | 귀속 책임 | 권고 전략 |
|------|------|----------|----------|
| **victim (희생자형)** | 자연재해·조직 비방·제품 변조 등 외부 요인 | 낮음 | 동정 호소·피해자 지원 |
| **accidental (사고형)** | 기술적 오류·예측 불가 사건 | 중간 | 사과+수정행동 |
| **preventable (예방가능형)** | 인적 과실·법규 위반·이익을 위한 위험 감수 | 높음 | 완전한 책임 인정+사과 |

## Image Repair Theory 전략 5유형 (Benoit, 1997)

1. **denial (부정)**: 위기와 무관함 주장 — 실제로 무관한 경우에만 사용
2. **evasion (책임회피)**: 의도 없음·과실·도발 상황 — 중간 책임 상황
3. **reduction (비중축소)**: 피해 경미하거나 보상 가능 — 낮은 책임 상황
4. **corrective-action (수정행동)**: 재발 방지 약속+구체적 개선 — 가장 공신력 높음
5. **mortification (사과)**: 완전한 책임 인정 — 예방가능형 위기의 필수 전략

## 골든타임 기준
- **critical (0~24시간)**: 이미 언론 1면, 소셜미디어 폭발적 확산
- **high (24~48시간)**: 확산 중이나 통제 가능 구간
- **medium (48~72시간)**: 확산 속도 둔화, 공식 대응 준비 시간 확보
- **low (72시간+)**: 초기 확산 고비 넘김, 사후 관리 단계
${ANALYSIS_CONSTRAINTS}`;
  },

  buildPromptWithContext(
    data: AnalysisInput,
    priorResults: Record<string, unknown>,
    _domain?: AnalysisDomain,
  ): string {
    const riskMap = priorResults['risk-map'] as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const macroView = priorResults['macro-view'] as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const riskContext = riskMap?.topRisks
      ? `## 식별된 주요 리스크\n${riskMap.topRisks
          .slice(0, 3)
          .map((r: Record<string, unknown>) => `- [${r.impactLevel}] ${r.title}: ${r.description}`)
          .join('\n')}`
      : '';

    const overallDirection = macroView?.overallDirection ?? '불명확';
    const summary = macroView?.summary ?? '';

    return `키워드: **${data.keyword}**
${formatDateRange(data)}

${riskContext}

## 여론 방향
- 전반적 방향: ${overallDirection}
- 요약: ${summary}

## 뉴스 기사 (최근 20건)
${data.articles
  .slice(0, 20)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 주요 댓글 반응 (30건)
${data.comments
  .slice(0, 30)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 120)}`)
  .join('\n')}

---
위 데이터를 바탕으로 SCCT 위기 유형을 분류하고, Image Repair Theory 기반 최적 대응 전략을 우선순위와 함께 제시하세요.
골든타임 평가 시 현재 여론 확산 속도와 강도를 반드시 반영하세요.`;
  },

  buildPrompt(data: AnalysisInput): string {
    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 뉴스 기사 (최근 20건)
${data.articles
  .slice(0, 20)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 주요 댓글 반응 (30건)
${data.comments
  .slice(0, 30)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 120)}`)
  .join('\n')}

---
위 데이터를 바탕으로 SCCT 위기 유형을 분류하고, Image Repair Theory 기반 최적 대응 전략을 우선순위와 함께 제시하세요.`;
  },
};
