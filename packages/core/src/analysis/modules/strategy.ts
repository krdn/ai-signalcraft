import { StrategySchema, type StrategyResult } from '../schemas/strategy.schema';
import type { AnalysisModule, AnalysisInput } from '../types';
import { MODULE_MODEL_MAP } from '../types';

const config = MODULE_MODEL_MAP['strategy'];

// 모듈7: 전략 도출 (DEEP-05)
// 리스크/기회 분석 결과를 종합하여 타겟/메시지/콘텐츠/리스크 대응 전략을 도출한다
export const strategyModule: AnalysisModule<StrategyResult> = {
  name: 'strategy',
  displayName: '종합 전략 도출',
  provider: config.provider,
  model: config.model,
  schema: StrategySchema,

  buildSystemPrompt(): string {
    return `당신은 여론 전략 수립 전문가입니다.
여론 분석, 리스크 평가, 기회 분석 결과를 종합하여 실행 가능한 전략을 도출합니다.
타겟 설정, 메시지 전략, 콘텐츠 전략, 리스크 대응 전략을 구체적으로 제안하세요.
반드시 한국어로 응답하세요.`;
  },

  buildPrompt(data: AnalysisInput): string {
    const articlesSummary = data.articles.slice(0, 15).map(a =>
      `- [${a.publisher ?? '알 수 없음'}] ${a.title}`
    ).join('\n');
    const commentsSample = data.comments.slice(0, 20).map(c =>
      `- ${c.content.slice(0, 100)}`
    ).join('\n');

    return `키워드: "${data.keyword}"
분석 기간: ${data.dateRange.start.toISOString().split('T')[0]} ~ ${data.dateRange.end.toISOString().split('T')[0]}

## 주요 기사 (${data.articles.length}건 중 상위 15건)
${articlesSummary}

## 대표 댓글 (${data.comments.length}건 중 상위 20건)
${commentsSample}

위 데이터를 기반으로 "${data.keyword}"에 대한 종합 전략을 도출하세요.
타겟 전략, 메시지 전략, 콘텐츠 전략, 리스크 대응 전략을 포함해야 합니다.`;
  },

  buildPromptWithContext(data: AnalysisInput, priorResults: Record<string, unknown>): string {
    const basePrompt = this.buildPrompt(data);

    // Stage 1 + Stage 2 (risk-map, opportunity) 결과 모두 참조
    const priorContext = Object.entries(priorResults)
      .filter(([key]) => [
        'macro-view', 'segmentation', 'sentiment-framing', 'message-impact',
        'risk-map', 'opportunity',
      ].includes(key))
      .map(([key, value]) => `### ${key}\n${JSON.stringify(value, null, 2)}`)
      .join('\n\n');

    return `${basePrompt}

## 선행 분석 결과 (Stage 1 + Stage 2)
${priorContext}

위 선행 분석 결과를 종합하여 전략을 도출하세요.
- risk-map의 주요 리스크에 대한 대응 전략을 수립하세요
- opportunity의 기회 요소를 활용한 공격적 전략을 포함하세요
- 감정 분석과 메시지 임팩트를 반영하여 메시지 전략을 수립하세요`;
  },
};
