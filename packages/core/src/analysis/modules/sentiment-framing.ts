import type { AnalysisModule, AnalysisInput } from '../types';
import type { AnalysisDomain } from '../domain';
import { MODULE_MODEL_MAP } from '../types';
import {
  SentimentFramingSchema,
  type SentimentFramingResult,
} from '../schemas/sentiment-framing.schema';
import {
  formatInputData,
  ANALYSIS_CONSTRAINTS,
  getPlatformKnowledge,
  getFrameStrengthAnchor,
  buildModuleSystemPrompt,
} from './prompt-utils';

// 모듈3: 감정 및 프레임 분석 (ANLZ-01, ANLZ-02, DEEP-01)
export const sentimentFramingModule: AnalysisModule<SentimentFramingResult> = {
  name: 'sentiment-framing',
  displayName: '감정 및 프레임 분석',
  provider: MODULE_MODEL_MAP['sentiment-framing'].provider,
  model: MODULE_MODEL_MAP['sentiment-framing'].model,
  schema: SentimentFramingSchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    const override = buildModuleSystemPrompt('sentiment-framing', domain);
    if (override) {
      return `${override}\n${getFrameStrengthAnchor(domain)}\n${getPlatformKnowledge(domain)}\n${ANALYSIS_CONSTRAINTS}`;
    }
    return `당신은 미디어 프레이밍(framing) 이론과 감정 분석(sentiment analysis) 전문가입니다.
온라인 여론 데이터에서 **감정의 분포, 핵심 키워드, 프레임의 경쟁 구조**를 정량·정성 분석합니다.

## 전문 역량
- 감정 비율 산출 시 플랫폼별 편향을 보정 (네이버 댓글의 부정 편향, 유튜브의 채널별 편향 등)
- 키워드 추출 시 단순 빈도가 아닌 "좋아요 가중 빈도"를 고려 (좋아요 많은 댓글의 키워드가 더 대표적)
- 프레임 식별 시 "같은 사실을 다르게 해석하는 관점"을 프레임으로 인식 (단순 토픽 ≠ 프레임)
- 연관어 네트워크에서 "함께 등장하면 의미가 변하는 키워드 조합"을 포착

## 프레임 vs 토픽 구분
- **토픽**: "경제", "교육", "외교" → 주제 영역 (프레임이 아님)
- **프레임**: "경제 실패론", "교육 개혁 기대론", "굴욕 외교론" → 같은 토픽을 특정 관점으로 해석
- 프레임은 반드시 "~론", "~프레임", "~서사" 형태로 명명하세요

${getFrameStrengthAnchor(domain)}
${getPlatformKnowledge(domain)}
${ANALYSIS_CONSTRAINTS}`;
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

## 분석 절차 (반드시 이 순서로 수행)

### Step 1: 감정 비율 산출
- 각 댓글·기사의 감정(긍정/부정/중립)을 판단하세요
- 플랫폼별 편향을 보정하여 전체 감정 비율을 산출하세요 (합계 1.0)
- 예: 네이버 댓글이 부정 70%라도 네이버 편향을 감안하면 실제 부정은 55% 수준일 수 있음

### Step 2: 키워드 추출 (topKeywords)
- 좋아요 수가 높은 댓글에 가중치를 두어 키워드를 추출하세요 (TOP 20)
- 각 키워드의 감정 극성(긍정/부정/중립)을 판단하세요
- 단순 고유명사(인물명, 정당명)는 제외하고 **의견이 담긴 키워드**를 추출하세요

### Step 3: 연관어 네트워크 (relatedKeywords) — 필수
Step 2에서 추출한 topKeywords 목록을 바탕으로, 기사/댓글에서 함께 등장하거나 같은 사건·맥락으로 묶이는 키워드 쌍을 반드시 작성하세요.
- topKeywords의 각 키워드에 대해 연관 키워드(relatedTo)를 2~4개 지정하세요
- 최소 5개 이상의 relatedKeywords 항목을 작성하세요 (빈 배열 [] 는 절대 금지)
- coOccurrenceScore: 연관 강도를 0.1~1.0으로 추정 (같은 문장에 자주 등장하면 0.8+, 같은 기사 단위면 0.4~0.7)
- context: 두 키워드가 어떤 맥락에서 함께 등장하는지 한 줄 설명
- 예시 (이재명 관련 분석):
  {"keyword": "검찰", "relatedTo": ["기소", "쌍방울", "수사"], "coOccurrenceScore": 0.75, "context": "검찰 기소 및 수사 관련 보도에서 동시 등장"}
  {"keyword": "북한", "relatedTo": ["대북송금", "김성태"], "coOccurrenceScore": 0.65, "context": "대북송금 사건 관련 키워드 클러스터"}
  {"keyword": "쌍방울", "relatedTo": ["김성태", "대북송금", "자백"], "coOccurrenceScore": 0.8, "context": "쌍방울 대북송금 사건의 핵심 인물·키워드 묶음"}

### Step 4: 프레임 식별
- 데이터에서 "같은 사실을 다르게 해석하는 관점"을 프레임으로 식별하세요
- 긍정 TOP5, 부정 TOP5를 추출하고 각 프레임의 강도를 1~10으로 평가하세요
- 프레임명은 구체적으로 (예: "무능론" (X) → "경제정책 무능론" (O))

### Step 5: 프레임 충돌 구조
- 현재 지배적인 프레임(dominant)과 이를 도전하는 프레임(challenging)을 식별하세요
- 두 프레임의 충돌이 여론에 어떤 영향을 미치는지 기술하세요`;
  },
};
