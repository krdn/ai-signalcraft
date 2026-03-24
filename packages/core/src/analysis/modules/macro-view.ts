import type { AnalysisModule, AnalysisInput } from '../types';
import { MODULE_MODEL_MAP } from '../types';
import { MacroViewSchema, type MacroViewResult } from '../schemas/macro-view.schema';
import { formatInputData } from './prompt-utils';

// 모듈1: 전체 여론 구조 분석 (ANLZ-01, ANLZ-03)
export const macroViewModule: AnalysisModule<MacroViewResult> = {
  name: 'macro-view',
  displayName: '전체 여론 구조 분석',
  provider: MODULE_MODEL_MAP['macro-view'].provider,
  model: MODULE_MODEL_MAP['macro-view'].model,
  schema: MacroViewSchema,

  buildSystemPrompt(): string {
    return `당신은 정치·여론·미디어 전략 데이터 분석 전문가입니다.
주어진 뉴스 기사, 영상, 댓글 데이터를 종합하여 전체 여론의 방향성을 분석합니다.
시간 흐름에 따른 여론 변화, 주요 이벤트별 반응, 변곡점을 식별하여 핵심 흐름을 요약합니다.
분석 결과는 반드시 한국어로 작성하며, 객관적이고 데이터 기반의 인사이트를 제공합니다.`;
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

위 데이터를 기반으로 "${data.keyword}"에 대한 전체 여론 구조를 분석하세요:
1. 전체 여론 방향성 (positive/negative/mixed)
2. 핵심 흐름 요약 (3~5줄)
3. 주요 이벤트 타임라인
4. 여론 변곡점
5. 일별 언급량 및 감성 추이`;
  },
};
