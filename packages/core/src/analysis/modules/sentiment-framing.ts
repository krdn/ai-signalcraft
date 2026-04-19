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
${videos.map((v, i) => `${i + 1}. [${v.channel}] ${v.title} (조회수: ${v.viewCount}, 좋아요: ${v.likeCount})${v.content ? `\n   ${v.content}` : ''}`).join('\n')}

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

### Step 3: 연관어 네트워크 (relatedKeywords) — ⚠️ 필수 / 절대 생략 금지
이 필드는 대시보드 "키워드 네트워크" 그래프의 **연결선(엣지)**을 만드는 유일한 원천입니다. 빈 배열이면 그래프가 파손됩니다.

**작성 규칙**:
- Step 2의 topKeywords 배열 길이의 **50% 이상**을 relatedKeywords 원소로 작성 (topKeywords가 20개면 최소 10개)
- 절대 하한: **최소 8개** (이 수치 미만이면 실패로 간주)
- 각 원소의 relatedTo 배열에는 **2~5개의 키워드**를 포함 (빈 배열 금지)
- relatedTo의 키워드는 **topKeywords 내 다른 키워드를 우선** 참조 (네트워크 연결성 확보). 필요하면 topKeywords 외부 키워드도 추가 가능
- coOccurrenceScore: 0.1~1.0 (같은 문장 0.8+, 같은 기사 단위 0.4~0.7, 주제 연관 0.2~0.4)
- context: 두 키워드가 어떤 맥락에서 함께 등장하는지 한 줄 설명

**좋은 예시** (정치 도메인):
  {"keyword": "검찰", "relatedTo": ["기소", "쌍방울", "수사"], "coOccurrenceScore": 0.75, "context": "검찰 기소 및 수사 관련 보도에서 동시 등장"}
  {"keyword": "북한", "relatedTo": ["대북송금", "김성태"], "coOccurrenceScore": 0.65, "context": "대북송금 사건 관련 키워드 클러스터"}
  {"keyword": "쌍방울", "relatedTo": ["김성태", "대북송금", "자백"], "coOccurrenceScore": 0.8, "context": "쌍방울 대북송금 사건의 핵심 인물·키워드 묶음"}

**출력 전 자가 점검**:
1. relatedKeywords 배열의 length가 8 이상인가?
2. 모든 원소의 relatedTo 배열이 비어있지 않은가?
3. topKeywords의 최상위 키워드가 적어도 하나의 relatedKeywords.keyword 또는 relatedTo에 포함되어 있는가?
세 조건 모두 YES일 때만 출력하세요. 하나라도 NO면 Step 3를 다시 작성하세요.

### Step 4: 프레임 식별
- 데이터에서 "같은 사실을 다르게 해석하는 관점"을 프레임으로 식별하세요
- 긍정 TOP5, 부정 TOP5를 추출하고 각 프레임의 강도를 1~10으로 평가하세요
- 프레임명은 구체적으로 (예: "무능론" (X) → "경제정책 무능론" (O))

### Step 5: 프레임 충돌 구조
- 현재 지배적인 프레임(dominant)과 이를 도전하는 프레임(challenging)을 식별하세요
- 두 프레임의 충돌이 여론에 어떤 영향을 미치는지 기술하세요`;
  },
};
