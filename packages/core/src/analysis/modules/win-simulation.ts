import { WinSimulationSchema, type WinSimulationResult } from '../schemas/win-simulation.schema';
import type { AnalysisModule, AnalysisInput } from '../types';
import { MODULE_MODEL_MAP } from '../types';

const config = MODULE_MODEL_MAP['win-simulation'];

// ADVN-04: 승리 확률 시뮬레이션 모듈
// 모든 선행 결과(Stage 1~3 + ADVN-01~03)를 종합하여 승리/패배 조건과 핵심 전략 도출
export const winSimulationModule: AnalysisModule<WinSimulationResult> = {
  name: 'win-simulation',
  displayName: '승리 확률 시뮬레이션',
  provider: config.provider,
  model: config.model,
  schema: WinSimulationSchema,

  buildSystemPrompt(): string {
    return `당신은 선거/여론 전략 시뮬레이션 전문가입니다.
모든 분석 결과를 종합하여 승리 확률을 추정하고, 승리/패배 조건과 핵심 전략을 도출합니다.
승리 확률은 0~100%로 표현하세요.
승리 조건은 최소 3개, 최대 7개를 도출하세요.
패배 조건은 최소 2개, 최대 5개를 도출하세요.
핵심 전략은 우선순위를 매겨 3~5개를 제시하세요.
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

위 데이터를 기반으로 "${data.keyword}"에 대한 승리 확률 시뮬레이션을 수행하세요.`;
  },

  buildPromptWithContext(data: AnalysisInput, priorResults: Record<string, unknown>): string {
    const basePrompt = this.buildPrompt(data);

    // 모든 선행 결과 참조 (Stage 1~3 + ADVN-01~03)
    const priorContext = Object.entries(priorResults)
      .map(([key, value]) => `### ${key}\n${JSON.stringify(value, null, 2)}`)
      .join('\n\n');

    return `${basePrompt}

## 전체 선행 분석 결과 (Stage 1~3 + 고급 분석)
${priorContext}

위 모든 분석 결과를 종합하여 승리 확률 시뮬레이션을 수행하세요:
- approval-rating의 현재 추정 지지율을 기반으로 승리 확률 산출
- frame-war의 프레임 구조를 전략 수립에 반영
- crisis-scenario의 위기 시나리오를 패배 조건/리스크로 활용
- risk-map과 opportunity를 승리/패배 조건에 반영
- strategy의 기존 전략을 핵심 전략의 기반으로 활용`;
  },
};
