import { FrameWarSchema, type FrameWarResult } from '../schemas/frame-war.schema';
import type { AnalysisModule, AnalysisInput } from '../types';
import { MODULE_MODEL_MAP } from '../types';

const config = MODULE_MODEL_MAP['frame-war'];

// ADVN-02: 프레임 전쟁 분석 모듈
// sentiment-framing 결과를 참조하여 프레임 간 충돌/지배 구조를 분석한다
export const frameWarModule: AnalysisModule<FrameWarResult> = {
  name: 'frame-war',
  displayName: '프레임 전쟁 분석',
  provider: config.provider,
  model: config.model,
  schema: FrameWarSchema,

  buildSystemPrompt(): string {
    return `당신은 미디어 프레임 분석 및 여론 전쟁 전문가입니다.
수집된 데이터에서 경쟁하는 프레임들을 식별하고, 지배적/위협적/반전 가능한 프레임을 분류합니다.
각 프레임의 강도(strength)를 0~100으로 평가하세요.
프레임 간 충돌 구조와 전략적 대응 방안을 제시하세요.
반드시 한국어로 응답하세요.`;
  },

  buildPrompt(data: AnalysisInput): string {
    const articlesSummary = data.articles
      .slice(0, 20)
      .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
      .join('\n');
    const commentsSample = data.comments
      .slice(0, 30)
      .map((c) => `- ${c.content.slice(0, 100)}`)
      .join('\n');

    return `키워드: "${data.keyword}"
분석 기간: ${data.dateRange.start.toISOString().split('T')[0]} ~ ${data.dateRange.end.toISOString().split('T')[0]}

## 주요 기사 (${data.articles.length}건 중 상위 20건)
${articlesSummary}

## 대표 댓글 (${data.comments.length}건 중 상위 30건)
${commentsSample}

위 데이터를 기반으로 "${data.keyword}"에 대한 프레임 전쟁을 분석하세요.
- 지배적 프레임 (최대 5개): 이름, 설명, 강도, 근거
- 위협적 프레임 (최대 5개): 이름, 설명, 위협 수준, 대응 전략
- 반전 가능 프레임 (최대 3개): 현재 인식, 반전 가능성, 필요 행동`;
  },

  buildPromptWithContext(data: AnalysisInput, priorResults: Record<string, unknown>): string {
    const basePrompt = this.buildPrompt(data);

    // sentiment-framing 결과를 핵심 참조
    const relevantModules = ['macro-view', 'sentiment-framing', 'message-impact'];
    const priorContext = Object.entries(priorResults)
      .filter(([key]) => relevantModules.includes(key))
      .map(([key, value]) => `### ${key}\n${JSON.stringify(value, null, 2)}`)
      .join('\n\n');

    return `${basePrompt}

## 선행 분석 결과
${priorContext}

위 선행 분석 결과, 특히 sentiment-framing의 프레임 유형 분석을 기반으로 프레임 간 충돌 구조를 심층 분석하세요.
message-impact에서 식별된 성공/실패 메시지와 프레임의 관계도 분석하세요.`;
  },
};
