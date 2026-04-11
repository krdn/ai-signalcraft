import {
  FandomCrisisScenarioSchema,
  type FandomCrisisScenarioResult,
} from '../../schemas/fandom-crisis-scenario.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import {
  ANALYSIS_CONSTRAINTS,
  getProbabilityAnchor,
  distillForCrisisScenario,
  formatDateRange,
} from '../prompt-utils';

const config = MODULE_MODEL_MAP['fandom-crisis-scenario'];

/**
 * ADVN-F03: 팬덤 위기 시나리오 모듈
 * crisis-scenario의 팬덤 도메인 대체.
 * 열애 루머, 표절 의혹, 기획사 갈등 등 팬덤 특유의 위기 시나리오를 분석한다.
 */
export const fandomCrisisScenarioModule: AnalysisModule<FandomCrisisScenarioResult> = {
  name: 'fandom-crisis-scenario',
  displayName: '팬덤 위기 시나리오',
  provider: config.provider,
  model: config.model,
  schema: FandomCrisisScenarioSchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    return `당신은 엔터 산업 위기 관리 및 팬덤 위기 시나리오 플래닝 전문가입니다.
팬덤 여론 데이터를 기반으로 **3가지 시나리오(확산/통제/역전)**를 구체적으로 시뮬레이션합니다.

## 시나리오 유형 (정확히 3개, 순서 고정)

1. **spread** (확산 - worst case): 위기가 통제 불능으로 확대되는 시나리오
2. **control** (통제 - moderate case): 위기를 현 수준에서 봉쇄·관리하는 시나리오
3. **reverse** (역전 - best case): 위기를 기회로 전환하여 팬덤 결속력을 강화하는 시나리오

## 팬덤 특유의 위기 유형
- **열애/스캔들**: 핵심 팬 이탈, 팬덤 내 분열, "배신감" 서사 확산
- **표절/저작권**: 전문가 평가 전까지 장기화, 안티팬 확산 가속
- **기획사 갈등**: 계약 해지, 멤버 탈퇴, 팬덤 분열 (가장 구조적 리스크)
- **SNS/과거 논란**: 인스티즈, 블라인드, 커뮤니티에서 급속 확산
- **경쟁 팬덤 공격**: 안티 갤러리 조직적 공격, 양측 이미지 손상
- **콘서트/행사 사고**: 안전 사고, 차별적 대우, 과도한 굿즈 가격

## 시나리오 품질 기준
- triggerConditions: 구체적 이벤트 (예: "대형 연예 매체 단독 보도", "해외 팬덤 대규모 항의")
- expectedOutcome: 정량적 결과 (예: "스트리밍 30% 하락", "팬카페 탈퇴 5000명", "브랜드 계약 해지 2건")
- responseStrategy: "누가(기획사/멤버/팬덤), 무엇을, 언제까지" 수준
- timeframe: 구체적 기간 (예: "24시간 내 공식 입장", "1주 내 팬미팅", "컴백 활동기간")

${getProbabilityAnchor(domain)}
${ANALYSIS_CONSTRAINTS}`;
  },

  buildPrompt(data: AnalysisInput): string {
    const articlesSummary = data.articles
      .slice(0, 15)
      .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
      .join('\n');
    const commentsSample = data.comments
      .slice(0, 20)
      .map((c) => `- ${c.content.slice(0, 100)}`)
      .join('\n');

    return `키워드: "${data.keyword}"
${formatDateRange(data)}

## 주요 기사 (${data.articles.length}건 중 상위 15건)
${articlesSummary}

## 대표 댓글 (${data.comments.length}건 중 상위 20건)
${commentsSample}

## 시나리오 구성 절차 (반드시 이 순서로 수행)

### Step 1: 현재 위기 수준 진단
- 현재 상황이 위기의 어느 단계에 있는지 판단하세요 (잠복기/발화기/확산기/수습기)

### Step 2: Spread 시나리오 (worst case)
- 가장 위험한 리스크가 현실화되면 어떤 경로로 확산되는지 시뮬레이션하세요
- 팬덤→일반 커뮤니티→언론→국제 팬덤으로의 확산 경로를 기술하세요

### Step 3: Control 시나리오 (moderate case)
- 적절한 대응으로 위기를 현 수준에서 봉쇄하는 경로를 시뮬레이션하세요
- 기획사 공식 입장, 팬 소통, 활동 조정 등을 포함하세요

### Step 4: Reverse 시나리오 (best case)
- 위기를 기회로 전환하여 팬덤 결속력을 강화하는 경로를 시뮬레이션하세요
- 반전을 위한 구체적 조건과 행동을 기술하세요

### Step 5: 종합 권장 조치
- 3개 시나리오를 종합하여 현재 가장 적합한 대응 방향을 제시하세요`;
  },

  buildPromptWithContext(
    data: AnalysisInput,
    priorResults: Record<string, unknown>,
    _domain?: AnalysisDomain,
  ): string {
    const basePrompt = this.buildPrompt(data);
    const distilledContext = distillForCrisisScenario(priorResults);

    return `${basePrompt}

## 선행 분석 핵심 요약
${distilledContext}

위 선행 분석을 기반으로 위기 시나리오를 구성하세요.
risk-map의 리스크를 재기술하지 말고, "리스크가 현실화되면 어떻게 전개되는가"를 시나리오로 전개하세요.`;
  },
};
