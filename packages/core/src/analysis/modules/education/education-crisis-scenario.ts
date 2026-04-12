import {
  EducationCrisisScenarioSchema,
  type EducationCrisisScenarioResult,
} from '../../schemas/education-crisis-scenario.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import { ANALYSIS_CONSTRAINTS, buildModuleSystemPrompt, formatDateRange } from '../prompt-utils';

const config = MODULE_MODEL_MAP['education-crisis-scenario'];

// Education-ADVN-03: 교육기관 위기 시나리오 모듈
// Social Contract Theory(Rawls, 1971) + Institutional Reputation Theory(Fombrun, 1996)
export const educationCrisisScenarioModule: AnalysisModule<EducationCrisisScenarioResult> = {
  name: 'education-crisis-scenario',
  displayName: '교육기관 위기 시나리오',
  provider: config.provider,
  model: config.model,
  schema: EducationCrisisScenarioSchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    const override = buildModuleSystemPrompt('education-crisis-scenario', domain);
    if (override) return `${override}\n${ANALYSIS_CONSTRAINTS}`;

    return `당신은 교육기관 위기 시나리오 플래닝 전문가입니다.
**Social Contract Theory in Education (Rawls, 1971)**과 **Institutional Reputation Theory (Fombrun, 1996)**를 적용하여 교육기관 여론 위기의 전개 시나리오를 시뮬레이션합니다.

## 교육 사회계약론 적용 (Rawls, 1971)
- 교육기관과 학생·사회 간 암묵적 계약: 등록금·세금 납부 ↔ 교육 가치(취업·성장·경험) 제공
- 계약 위반 차원: 취업률 허위 / 교육 품질 저하 / 학사 비리 / 학생 복지 소홀
- 계약 위반 심각도가 클수록 여론 위기 확산 속도 빨라짐

## 시나리오 유형 (정확히 3개, 순서 고정)
1. **spread** (확산 - worst case): 학사 비리·교수 문제·취업률 조작 의혹이 전국 언론에 이슈화, 입학 지원자 급감·기관 신뢰 붕괴
2. **control** (통제 - moderate case): 내부 개선과 투명한 소통으로 이슈를 기관 내부로 한정, 외부 확산 없이 관리
3. **reverse** (역전 - best case): 위기 대응 과정에서 진정성 있는 개혁이 오히려 기관 신뢰를 높이는 전환

## risk-map과의 차별화
- risk-map의 리스크 목록을 재기술하지 말 것
- "리스크가 현실화되면 어떤 교육기관 평판 경로로 전개되는가"를 시나리오로 전개
- triggerConditions: 교육기관 맥락 이벤트 (예: "교육부 감사 착수", "재학생 단체 성명 발표", "취업률 허위 보도")
${ANALYSIS_CONSTRAINTS}`;
  },

  buildPromptWithContext(
    data: AnalysisInput,
    priorResults: Record<string, unknown>,
    _domain?: AnalysisDomain,
  ): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const riskMap = priorResults['risk-map'] as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reputationIndex = priorResults['institutional-reputation-index'] as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opinionFrame = priorResults['education-opinion-frame'] as any;

    const topRisks = riskMap?.risks
      ? (riskMap.risks as { name: string; severity: string }[])
          .slice(0, 4)
          .map((r) => `- ${r.name} (심각도: ${r.severity})`)
          .join('\n')
      : '';

    const reputationScore = reputationIndex?.reputationIndex ?? '데이터 없음';
    const frameDynamics = opinionFrame?.frameDynamics?.currentBalance ?? '데이터 없음';

    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 선행 분석 요약
- 주요 리스크 (risk-map):\n${topRisks}
- 현재 기관 평판 지수: ${reputationScore}/100 (institutional-reputation-index)
- 현재 프레임 균형: ${frameDynamics} (education-opinion-frame)

## 뉴스 기사 (최근 20건)
${data.articles
  .slice(0, 20)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 주요 댓글 (30건)
${data.comments
  .slice(0, 30)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 150)}`)
  .join('\n')}

---
Social Contract Theory(Rawls, 1971)로 교육기관-학생 간 계약 위반 차원을 식별하세요.
spread/control/reverse 3가지 시나리오를 반드시 이 순서로 작성하세요.
각 시나리오에 교육기관 특화 triggerConditions(교육부 감사, 재학생 성명 등)를 명시하세요.
risk-map 결과를 재기술하지 말고, 리스크가 현실화된 이후 평판 전개 경로를 시나리오로 전개하세요.`;
  },

  buildPrompt(data: AnalysisInput): string {
    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 뉴스 기사 (최근 20건)
${data.articles
  .slice(0, 20)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 주요 댓글 (30건)
${data.comments
  .slice(0, 30)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 150)}`)
  .join('\n')}

---
교육기관 위기 시나리오를 spread/control/reverse 3개로 시뮬레이션하세요.`;
  },
};
