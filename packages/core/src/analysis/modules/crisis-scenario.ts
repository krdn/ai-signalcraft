import { CrisisScenarioSchema, type CrisisScenarioResult } from '../schemas/crisis-scenario.schema';
import type { AnalysisModule, AnalysisInput } from '../types';
import { MODULE_MODEL_MAP } from '../types';

const config = MODULE_MODEL_MAP['crisis-scenario'];

// ADVN-03: 위기 대응 시나리오 모듈
// risk-map + ADVN-01(approval-rating) 결과를 참조하여 3개 시나리오 생성
export const crisisScenarioModule: AnalysisModule<CrisisScenarioResult> = {
  name: 'crisis-scenario',
  displayName: '위기 대응 시나리오',
  provider: config.provider,
  model: config.model,
  schema: CrisisScenarioSchema,

  buildSystemPrompt(): string {
    return `당신은 위기 관리 및 시나리오 분석 전문가입니다.
여론 데이터와 리스크 분석 결과를 기반으로 3가지 위기 대응 시나리오를 생성합니다.
반드시 3개 시나리오를 다음 순서로 생성하세요:
1. spread (확산 시나리오 - worst case): 위기가 확산되는 최악의 경우
2. control (통제 시나리오 - moderate case): 위기를 통제하는 중간 경우
3. reverse (역전 시나리오 - best case): 위기를 역전시키는 최선의 경우
각 시나리오에 발생 확률, 트리거 조건, 예상 결과, 대응 전략, 시간 범위를 포함하세요.
반드시 한국어로 응답하세요.`;
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
분석 기간: ${data.dateRange.start.toISOString().split('T')[0]} ~ ${data.dateRange.end.toISOString().split('T')[0]}

## 주요 기사 (${data.articles.length}건 중 상위 15건)
${articlesSummary}

## 대표 댓글 (${data.comments.length}건 중 상위 20건)
${commentsSample}

위 데이터를 기반으로 "${data.keyword}"에 대한 3가지 위기 대응 시나리오를 생성하세요.
각 시나리오에 발생 확률, 트리거 조건, 예상 결과, 대응 전략을 포함해야 합니다.`;
  },

  buildPromptWithContext(data: AnalysisInput, priorResults: Record<string, unknown>): string {
    const basePrompt = this.buildPrompt(data);

    // risk-map + approval-rating + Stage 1 결과 참조
    const relevantModules = ['macro-view', 'sentiment-framing', 'risk-map', 'approval-rating'];
    const priorContext = Object.entries(priorResults)
      .filter(([key]) => relevantModules.includes(key))
      .map(([key, value]) => `### ${key}\n${JSON.stringify(value, null, 2)}`)
      .join('\n\n');

    return `${basePrompt}

## 선행 분석 결과
${priorContext}

위 선행 분석 결과를 종합하여 시나리오를 생성하세요:
- risk-map의 주요 리스크를 시나리오 트리거로 활용
- approval-rating의 현재 지지율 추정치를 기반선으로 활용
- 각 시나리오의 지지율 변동 예측을 포함`;
  },
};
