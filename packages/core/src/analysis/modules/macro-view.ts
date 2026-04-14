import type { AnalysisModule, AnalysisInput } from '../types';
import type { AnalysisDomain } from '../domain';
import { MODULE_MODEL_MAP } from '../types';
import { MacroViewSchema, type MacroViewResult } from '../schemas/macro-view.schema';
import {
  formatInputData,
  ANALYSIS_CONSTRAINTS,
  getPlatformKnowledge,
  buildModuleSystemPrompt,
} from './prompt-utils';

// 모듈1: 전체 여론 구조 분석 (ANLZ-01, ANLZ-03)
export const macroViewModule: AnalysisModule<MacroViewResult> = {
  name: 'macro-view',
  displayName: '전체 여론 구조 분석',
  provider: MODULE_MODEL_MAP['macro-view'].provider,
  model: MODULE_MODEL_MAP['macro-view'].model,
  schema: MacroViewSchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    const override = buildModuleSystemPrompt('macro-view', domain);
    if (override) {
      return `${override}\n${getPlatformKnowledge(domain)}\n${ANALYSIS_CONSTRAINTS}`;
    }
    return `당신은 15년 경력의 정치 여론 동향 분석가입니다.
한국 온라인 여론 데이터(뉴스, 유튜브, 커뮤니티 댓글)를 종합하여 **시간축 기반 여론 구조**를 파악합니다.

## 전문 역량
- 일별/주별 여론 흐름의 변곡점(inflection point)을 정확히 포착
- 이벤트-반응 간 인과관계를 추론하여 타임라인 구성
- 플랫폼별 데이터 편향을 보정한 종합 방향성 판단
- 단순 감정 집계가 아닌, 여론의 **구조적 흐름**(상승→정체→반전 등)을 서사로 구성
${getPlatformKnowledge(domain)}
${ANALYSIS_CONSTRAINTS}`;
  },

  buildPrompt(data: AnalysisInput): string {
    const { articles, videos, comments, dateRange } = formatInputData(data);

    // 날짜별 언급량 사전 집계 — AI가 직접 세지 않아도 되게 주입
    const dailyCountMap = new Map<string, number>();
    for (const a of articles) {
      if (a.publishedAt && a.publishedAt !== '날짜 미상') {
        dailyCountMap.set(a.publishedAt, (dailyCountMap.get(a.publishedAt) ?? 0) + 1);
      }
    }
    for (const c of comments) {
      if (c.publishedAt && c.publishedAt !== '날짜 미상') {
        dailyCountMap.set(c.publishedAt, (dailyCountMap.get(c.publishedAt) ?? 0) + 1);
      }
    }
    const preCounted = Array.from(dailyCountMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => `  {"date": "${date}", "count": ${count}}`)
      .join(',\n');

    return `## 분석 대상: "${data.keyword}"
## 분석 기간: ${dateRange}

### 뉴스 기사 (${articles.length}건)
${articles.map((a, i) => `${i + 1}. [${a.publishedAt}][${a.source}] ${a.title}\n   ${a.content}`).join('\n')}

### 영상 (${videos.length}건)
${videos.map((v, i) => `${i + 1}. [${v.publishedAt}][${v.channel}] ${v.title} (조회수: ${v.viewCount}, 좋아요: ${v.likeCount})`).join('\n')}

### 댓글 (${comments.length}건)
${comments.map((c, i) => `${i + 1}. [${c.publishedAt}][${c.source}] ${c.content} (좋아요: ${c.likeCount})`).join('\n')}

## 날짜별 언급량 (사전 집계)
아래는 기사+댓글 발행일 기준으로 미리 집계한 날짜별 건수입니다.
dailyMentionTrend의 count 값으로 그대로 사용하세요:
[
${preCounted}
]

## 분석 절차 (반드시 이 순서로 수행)

### Step 1: 이벤트-반응 매핑
- 언급량이 급증(전일 대비 2배 이상)하거나 급감한 날짜의 원인 기사·발언·사건을 식별하세요
- "이벤트 → 플랫폼별 반응 → 후속 영향"의 인과 체인을 구성하세요

### Step 2: 변곡점 판별
- 감정 기조가 전환된 시점(긍정→부정, 또는 반대)을 변곡점으로 식별하세요
- 변곡점 전후의 감정 변화를 구체적으로 기술하세요 (beforeSentiment → afterSentiment)

### Step 3: 구조적 서사 구성
- 위 분석을 종합하여 전체 여론의 흐름을 3~5줄의 서사(narrative)로 요약하세요
- 단순 나열이 아닌, "A 때문에 B가 발생했고, 이로 인해 C로 전환됨" 형태의 인과적 서사를 작성하세요

### Step 4: 일별 언급량 추이 (dailyMentionTrend 필드) — 필수
위의 "날짜별 언급량 (사전 집계)" 배열을 기반으로 dailyMentionTrend를 반드시 채우세요.
- count 값은 사전 집계된 값을 그대로 사용하세요
- 각 날짜의 sentimentRatio는 해당 날짜 기사/댓글의 내용을 분석하여 감정 비율(합계=1.0)로 추정하세요
- 데이터가 있는 모든 날짜를 포함하세요 (빈 배열 [] 금지)
- 예시: {"date": "2026-04-06", "count": 12, "sentimentRatio": {"positive": 0.4, "negative": 0.4, "neutral": 0.2}}`;
  },
};
