import type { AnalysisModule, AnalysisInput } from '../types';
import { MODULE_MODEL_MAP } from '../types';
import {
  SentimentFramingSchema,
  type SentimentFramingResult,
} from '../schemas/sentiment-framing.schema';
import { formatInputData } from './prompt-utils';

// 모듈3: 감정 및 프레임 분석 (ANLZ-01, ANLZ-02, DEEP-01)
export const sentimentFramingModule: AnalysisModule<SentimentFramingResult> = {
  name: 'sentiment-framing',
  displayName: '감정 및 프레임 분석',
  provider: MODULE_MODEL_MAP['sentiment-framing'].provider,
  model: MODULE_MODEL_MAP['sentiment-framing'].model,
  schema: SentimentFramingSchema,

  buildSystemPrompt(): string {
    return `당신은 정치·여론·미디어 전략 데이터 분석 전문가입니다.
주어진 데이터에서 감정 비율, 반복 키워드, 연관어 네트워크, 프레임 유형을 분석합니다.
긍정/부정 프레임 TOP5를 추출하고 프레임 간 충돌 구조를 식별합니다.
연관어 네트워크를 통해 키워드 간 관계를 파악하고 여론의 구조적 패턴을 도출합니다.
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

위 데이터를 기반으로 "${data.keyword}"에 대한 감정 및 프레임을 분석하세요:
1. 감정 비율 (긍정/부정/중립, 합계 1.0)
2. 반복 키워드 TOP 20 (키워드, 빈도, 감정)
3. 연관어 네트워크 (키워드 간 동시출현 관계)
4. 긍정 프레임 TOP5 (프레임명, 설명, 강도 1~10)
5. 부정 프레임 TOP5 (프레임명, 설명, 강도 1~10)
6. 프레임 충돌 구조 (지배적 프레임 vs 도전 프레임)`;
  },
};
