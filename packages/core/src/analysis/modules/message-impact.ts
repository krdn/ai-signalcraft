import type { AnalysisModule, AnalysisInput } from '../types';
import { MODULE_MODEL_MAP } from '../types';
import { MessageImpactSchema, type MessageImpactResult } from '../schemas/message-impact.schema';
import { formatInputData } from './prompt-utils';

// 모듈4: 메시지 효과 분석 (DEEP-02)
export const messageImpactModule: AnalysisModule<MessageImpactResult> = {
  name: 'message-impact',
  displayName: '메시지 효과 분석',
  provider: MODULE_MODEL_MAP['message-impact'].provider,
  model: MODULE_MODEL_MAP['message-impact'].model,
  schema: MessageImpactSchema,

  buildSystemPrompt(): string {
    return `당신은 정치·여론·미디어 전략 데이터 분석 전문가입니다.
주어진 데이터에서 여론을 움직인 발언과 콘텐츠를 식별하고, 확산력 높은 유형을 분석합니다.
성공 메시지(긍정적 반응 유발)와 실패 메시지(부정적 반응 유발)를 구분하여 평가합니다.
각 메시지의 영향력 점수, 확산 유형, 성공/실패 이유를 구체적으로 제시합니다.
분석 결과는 반드시 한국어로 작성합니다.`;
  },

  buildPrompt(data: AnalysisInput): string {
    const { articles, videos, comments, dateRange } = formatInputData(data);

    return `## 분석 대상: "${data.keyword}"
## 분석 기간: ${dateRange}

### 뉴스 기사 (${articles.length}건)
${articles.map((a, i) => `${i + 1}. [${a.source}] ${a.title}\n   ${a.content}`).join('\n')}

### 영상 (${videos.length}건)
${videos.map((v, i) => `${i + 1}. [${v.channel}] ${v.title} (조회수: ${v.viewCount}, 좋아요: ${v.likeCount})`).join('\n')}

### 댓글 (${comments.length}건)
${comments.map((c, i) => `${i + 1}. [${c.source}] ${c.content} (좋아요: ${c.likeCount})`).join('\n')}

위 데이터를 기반으로 "${data.keyword}"에 대한 메시지 효과를 분석하세요:
1. 성공 메시지 (긍정 반응을 유발한 발언/콘텐츠, 영향력 점수, 확산 유형)
2. 실패 메시지 (부정 반응을 유발한 발언/콘텐츠, 부정 점수, 피해 유형)
3. 확산력 높은 콘텐츠 유형 (유형, 설명, 사례 수)`;
  },
};
