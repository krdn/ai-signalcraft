import { OpportunitySchema, type OpportunityResult } from '../schemas/opportunity.schema';
import type { AnalysisModule, AnalysisInput } from '../types';
import { MODULE_MODEL_MAP } from '../types';

const config = MODULE_MODEL_MAP['opportunity'];

// 모듈6: 기회 분석 (DEEP-04)
// 긍정 요소와 미활용 영역을 분석하여 확장 기회를 도출한다
export const opportunityModule: AnalysisModule<OpportunityResult> = {
  name: 'opportunity',
  displayName: '기회 요소 분석',
  provider: config.provider,
  model: config.model,
  schema: OpportunitySchema,

  buildSystemPrompt(): string {
    return `당신은 여론 데이터 기반 기회 분석 전문가입니다.
수집된 데이터에서 긍정적인 요소, 미활용된 잠재력, 확장 가능한 영역을 식별합니다.
현재 충분히 활용되지 않고 있는 긍정 자산과 새로운 기회를 구체적으로 제안하세요.
반드시 한국어로 응답하세요.`;
  },

  buildPrompt(data: AnalysisInput): string {
    const articlesSummary = data.articles.slice(0, 20).map(a =>
      `- [${a.publisher ?? '알 수 없음'}] ${a.title}`
    ).join('\n');
    const commentsSample = data.comments.slice(0, 30).map(c =>
      `- ${c.content.slice(0, 100)}`
    ).join('\n');

    return `키워드: "${data.keyword}"
분석 기간: ${data.dateRange.start.toISOString().split('T')[0]} ~ ${data.dateRange.end.toISOString().split('T')[0]}

## 주요 기사 (${data.articles.length}건 중 상위 20건)
${articlesSummary}

## 대표 댓글 (${data.comments.length}건 중 상위 30건)
${commentsSample}

위 데이터를 기반으로 "${data.keyword}"에 대한 긍정 자산과 미활용 기회를 분석하세요.`;
  },

  buildPromptWithContext(data: AnalysisInput, priorResults: Record<string, unknown>): string {
    const basePrompt = this.buildPrompt(data);

    const priorContext = Object.entries(priorResults)
      .filter(([key]) => ['macro-view', 'segmentation', 'sentiment-framing', 'message-impact'].includes(key))
      .map(([key, value]) => `### ${key}\n${JSON.stringify(value, null, 2)}`)
      .join('\n\n');

    return `${basePrompt}

## 선행 분석 결과 (Stage 1)
${priorContext}

위 선행 분석 결과를 참고하여 기회 요소를 도출하세요.
긍정 프레임, 성공적인 메시지, 특정 플랫폼에서의 우호적 반응 등을 기회 후보로 고려하세요.`;
  },
};
