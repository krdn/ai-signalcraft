import {
  StakeholderMapSchema,
  type StakeholderMapResult,
} from '../../schemas/stakeholder-map.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import { ANALYSIS_CONSTRAINTS, buildModuleSystemPrompt, formatDateRange } from '../prompt-utils';

const config = MODULE_MODEL_MAP['stakeholder-map'];

// Corporate-ADVN-01: 이해관계자 영향력 매핑 모듈 (Stakeholder Salience Model)
export const stakeholderMapModule: AnalysisModule<StakeholderMapResult> = {
  name: 'stakeholder-map',
  displayName: '이해관계자 영향력 지도',
  provider: config.provider,
  model: config.model,
  schema: StakeholderMapSchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    const override = buildModuleSystemPrompt('stakeholder-map', domain);
    if (override) return `${override}\n${ANALYSIS_CONSTRAINTS}`;

    return `당신은 기업 이해관계자 분석 전문가입니다.
**Stakeholder Salience Model (Mitchell, Agle & Wood, 1997)**을 적용하여 이해관계자 영향력을 매핑합니다.

## 이해관계자 현출성(Salience) 3가지 속성

| 속성 | 설명 | 측정 방법 |
|------|------|---------|
| **Power (권력)** | 기업 행동에 영향을 미칠 수 있는 능력 | 규제권·구매력·미디어 파워 |
| **Legitimacy (합법성)** | 요구의 사회적·법적 정당성 | 계약관계·법적 권리·사회적 기대 |
| **Urgency (긴급성)** | 요구의 긴급성과 중요성 | 즉각 대응 필요성·데드라인 |

## 현출성 결합 유형 (3가지 속성 조합)
- **Dormant (잠면)**: 권력만 있음 — 낮은 우선순위, 모니터링
- **Discretionary (재량)**: 합법성만 있음 — 사회적 책임 차원 관리
- **Demanding (요구형)**: 긴급성만 있음 — 성가시지만 당장 위험하지 않음
- **Dominant (지배형)**: 권력+합법성 — 공식적 관계, 정기 소통
- **Dangerous (위험형)**: 권력+긴급성 — 즉각 대응 필요
- **Dependent (의존형)**: 합법성+긴급성 — 다른 강력 이해관계자가 대변
- **Definitive (최우선형)**: 3가지 모두 — 즉각적이고 전략적 관리 필수
${ANALYSIS_CONSTRAINTS}`;
  },

  buildPromptWithContext(
    data: AnalysisInput,
    priorResults: Record<string, unknown>,
    _domain?: AnalysisDomain,
  ): string {
    const segmentation = priorResults['segmentation'] as Record<string, unknown>;
    const riskMap = priorResults['risk-map'] as Record<string, unknown>;

    const audienceGroups = segmentation?.audienceGroups
      ? segmentation.audienceGroups
          .map(
            (g: Record<string, unknown>) =>
              `- ${g.groupName} [${g.type}]: ${g.sentiment}, 영향력: ${g.influence}`,
          )
          .join('\n')
      : '';

    const topRisks = riskMap?.topRisks
      ? riskMap.topRisks
          .slice(0, 3)
          .map((r: Record<string, unknown>) => `- ${r.title}: ${r.description}`)
          .join('\n')
      : '';

    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 선행 집단 분석 결과
${audienceGroups}

## 주요 리스크
${topRisks}

## 뉴스 기사 (최근 15건)
${data.articles
  .slice(0, 15)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 주요 댓글 (30건)
${data.comments
  .slice(0, 30)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 120)}`)
  .join('\n')}

---
Stakeholder Salience Model(권력·합법성·긴급성)을 기반으로 이해관계자 현출성 점수를 산출하고, 우선순위별 대응 전략을 제시하세요.
가장 긴급하게 관리해야 할 이해관계자와 즉시 취해야 할 조치를 명확히 지정하세요.`;
  },

  buildPrompt(data: AnalysisInput): string {
    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 뉴스 기사 (최근 15건)
${data.articles
  .slice(0, 15)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 댓글 (30건)
${data.comments
  .slice(0, 30)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 120)}`)
  .join('\n')}

---
Stakeholder Salience Model을 적용하여 이해관계자를 분류하고 영향력 지도를 작성하세요.`;
  },
};
