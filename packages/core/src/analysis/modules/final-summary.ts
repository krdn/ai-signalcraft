import { FinalSummarySchema, type FinalSummaryResult } from '../schemas/final-summary.schema';
import type { AnalysisModule, AnalysisInput } from '../types';
import { MODULE_MODEL_MAP } from '../types';

const config = MODULE_MODEL_MAP['final-summary'];

// 모듈8: 최종 전략 요약 (REPT-02)
// 전체 분석 결과를 종합하여 현재 상태 + 승부 핵심 한 줄 요약을 생성한다
export const finalSummaryModule: AnalysisModule<FinalSummaryResult> = {
  name: 'final-summary',
  displayName: '최종 전략 요약',
  provider: config.provider,
  model: config.model,
  schema: FinalSummarySchema,

  buildSystemPrompt(): string {
    return `당신은 여론 분석 종합 전략가입니다.
여러 단계의 분석 결과를 종합하여 의사결정자가 즉시 활용할 수 있는 최종 요약을 작성합니다.
'한 줄 요약(oneLiner)'은 현재 상태와 승부 핵심을 한 문장으로 압축해야 합니다.
예: "지지율 하락세 속 MZ세대 이탈이 핵심 변수 -- 교육정책 어필이 돌파구"
반드시 한국어로 응답하세요.`;
  },

  buildPrompt(data: AnalysisInput): string {
    const articlesSummary = data.articles.slice(0, 10).map(a =>
      `- [${a.publisher ?? '알 수 없음'}] ${a.title}`
    ).join('\n');

    return `키워드: "${data.keyword}"
분석 기간: ${data.dateRange.start.toISOString().split('T')[0]} ~ ${data.dateRange.end.toISOString().split('T')[0]}
기사 수: ${data.articles.length}건 | 댓글 수: ${data.comments.length}건 | 영상 수: ${data.videos.length}건

## 주요 기사 (상위 10건)
${articlesSummary}

위 데이터를 기반으로 "${data.keyword}"에 대한 최종 전략 요약을 작성하세요.
현재 상태, 최우선 실행 과제, 단기/중기 전망을 포함해야 합니다.`;
  },

  buildPromptWithContext(data: AnalysisInput, priorResults: Record<string, unknown>): string {
    const basePrompt = this.buildPrompt(data);

    // 전체 선행 분석 결과 참조 (Stage 1 + Stage 2)
    const priorContext = Object.entries(priorResults)
      .map(([key, value]) => `### ${key}\n${JSON.stringify(value, null, 2)}`)
      .join('\n\n');

    return `${basePrompt}

## 전체 분석 결과 (Stage 1 + Stage 2)
${priorContext}

위 전체 분석 결과를 종합하여 최종 전략 요약을 작성하세요.
- oneLiner: 현재 상태와 승부 핵심을 한 문장으로 압축
- criticalActions: 최우선 실행 과제 3~5개 (우선순위 순)
- outlook: 단기(1~2주), 중기(1~3개월) 전망과 핵심 변수`;
  },
};
