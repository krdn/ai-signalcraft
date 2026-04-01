import { ApprovalRatingSchema, type ApprovalRatingResult } from '../schemas/approval-rating.schema';
import type { AnalysisModule, AnalysisInput } from '../types';
import { MODULE_MODEL_MAP } from '../types';

const config = MODULE_MODEL_MAP['approval-rating'];

// ADVN-01: AI 지지율 추정 모듈
// 감정 비율과 플랫폼 편향을 보정하여 범위(range)로 산출한다
export const approvalRatingModule: AnalysisModule<ApprovalRatingResult> = {
  name: 'approval-rating',
  displayName: 'AI 지지율 추정',
  provider: config.provider,
  model: config.model,
  schema: ApprovalRatingSchema,

  buildSystemPrompt(): string {
    return `당신은 여론 데이터 기반 지지율 추정 전문가입니다.
수집된 뉴스 기사, 영상, 댓글 데이터를 분석하여 AI 기반 지지율 추정치를 산출합니다.
추정치는 반드시 범위(min~max)로 표현하세요. 단일 수치가 아닌 범위로 산출하는 것이 핵심입니다.
플랫폼별 편향(보수/진보 성향 차이)을 보정하세요.
면책 문구를 반드시 포함하세요: 이 추정치는 AI 분석 기반 참고용이며, 과학적 여론조사를 대체하지 않습니다.
반드시 한국어로 응답하세요.`;
  },

  buildPrompt(data: AnalysisInput): string {
    const articlesSummary = data.articles
      .slice(0, 20)
      .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
      .join('\n');
    const commentsSample = data.comments
      .slice(0, 30)
      .map((c) => `- [${c.source}] ${c.content.slice(0, 100)}`)
      .join('\n');

    // 플랫폼별 데이터 분포 계산
    const platformDist: Record<string, number> = {};
    for (const c of data.comments) {
      platformDist[c.source] = (platformDist[c.source] ?? 0) + 1;
    }
    const platformSummary = Object.entries(platformDist)
      .map(([src, cnt]) => `${src}: ${cnt}건`)
      .join(', ');

    return `키워드: "${data.keyword}"
분석 기간: ${data.dateRange.start.toISOString().split('T')[0]} ~ ${data.dateRange.end.toISOString().split('T')[0]}

## 주요 기사 (${data.articles.length}건 중 상위 20건)
${articlesSummary}

## 대표 댓글 (${data.comments.length}건 중 상위 30건)
${commentsSample}

## 플랫폼별 데이터 분포
${platformSummary}

위 데이터를 기반으로 "${data.keyword}"에 대한 AI 지지율 추정을 수행하세요.
- 감정 비율(긍정/중립/부정)을 분석하세요
- 플랫폼별 편향을 보정하세요
- 추정치를 범위(min~max)로 산출하세요
- 면책 문구를 반드시 포함하세요`;
  },

  buildPromptWithContext(data: AnalysisInput, priorResults: Record<string, unknown>): string {
    const basePrompt = this.buildPrompt(data);

    // Stage 1~3 결과 중 감정/프레임 관련 결과 참조
    const relevantModules = ['macro-view', 'segmentation', 'sentiment-framing', 'message-impact'];
    const priorContext = Object.entries(priorResults)
      .filter(([key]) => relevantModules.includes(key))
      .map(([key, value]) => `### ${key}\n${JSON.stringify(value, null, 2)}`)
      .join('\n\n');

    return `${basePrompt}

## 선행 분석 결과 (Stage 1~3)
${priorContext}

위 선행 분석 결과의 감정 비율, 집단별 반응, 프레임 분석을 참고하여 더 정확한 지지율 추정을 수행하세요.
특히 sentiment-framing의 감정 비율과 segmentation의 집단별 차이를 보정 요인으로 활용하세요.`;
  },
};
