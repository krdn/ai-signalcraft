import { RiskMapSchema, type RiskMapResult } from '../schemas/risk-map.schema';
import type { AnalysisModule, AnalysisInput } from '../types';
import { MODULE_MODEL_MAP } from '../types';

const config = MODULE_MODEL_MAP['risk-map'];

// 모듈5: 리스크 맵 분석 (DEEP-03)
// Stage 1 결과를 참조하여 Top 3~5 리스크와 영향도/확산 가능성을 분석한다
export const riskMapModule: AnalysisModule<RiskMapResult> = {
  name: 'risk-map',
  displayName: '리스크 맵 분석',
  provider: config.provider,
  model: config.model,
  schema: RiskMapSchema,

  buildSystemPrompt(): string {
    return `당신은 여론 데이터 기반 리스크 분석 전문가입니다.
수집된 뉴스 기사, 영상, 댓글 데이터를 분석하여 해당 키워드(인물/이슈)에 대한 주요 리스크를 도출합니다.
각 리스크의 영향도(impactLevel)와 확산 가능성(spreadProbability)을 객관적으로 평가하세요.
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

위 데이터를 기반으로 "${data.keyword}"에 대한 리스크 맵을 분석하세요.
Top 3~5 리스크를 도출하고, 각 리스크의 영향도, 확산 가능성, 현재 상태, 트리거 조건을 평가하세요.`;
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

위 선행 분석 결과를 참고하여 더 정확한 리스크 맵을 도출하세요.
감정 분석에서 부정 프레임이 강한 영역, 확산력 높은 부정 메시지 등을 리스크 후보로 고려하세요.`;
  },
};
