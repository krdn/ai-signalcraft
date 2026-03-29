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

위 데이터를 기반으로 "${data.keyword}"에 대한 메시지 효과를 분석하세요.
반드시 아래 3개 항목을 모두 포함하여 JSON으로 응답하세요:

1. successMessages: 긍정 반응을 유발한 발언/콘텐츠 배열 (3~7개)
   - content: 실제 발언/제목 인용
   - source: 출처 (naver/youtube/clien/fmkorea/dcinside)
   - impactScore: 영향력 점수 (1~10 정수)
   - reason: 긍정 반응 유발 이유
   - spreadType: 확산 유형 (예: "커뮤니티 공감", "뉴스 확산", "댓글 바이럴")

2. failureMessages: 부정 반응을 유발한 발언/콘텐츠 배열 (3~7개)
   - content: 실제 발언/제목 인용
   - source: 출처
   - negativeScore: 부정 점수 (1~10 정수)
   - reason: 부정 반응 유발 이유
   - damageType: 피해 유형 (예: "신뢰도 하락", "지지층 이탈", "프레임 역공")

3. highSpreadContentTypes: 확산력 높은 콘텐츠 유형 배열 (2~5개)
   - type: 콘텐츠 유형명
   - description: 설명
   - exampleCount: 해당 유형 사례 수 (정수)`;
  },
};
