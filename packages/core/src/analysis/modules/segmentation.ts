import type { AnalysisModule, AnalysisInput } from '../types';
import { MODULE_MODEL_MAP } from '../types';
import { SegmentationSchema, type SegmentationResult } from '../schemas/segmentation.schema';
import { formatInputData } from './prompt-utils';

// 모듈2: 집단별 반응 분석 (ANLZ-04)
export const segmentationModule: AnalysisModule<SegmentationResult> = {
  name: 'segmentation',
  displayName: '집단별 반응 분석',
  provider: MODULE_MODEL_MAP['segmentation'].provider,
  model: MODULE_MODEL_MAP['segmentation'].model,
  schema: SegmentationSchema,

  buildSystemPrompt(): string {
    return `당신은 정치·여론·미디어 전략 데이터 분석 전문가입니다.
주어진 데이터를 플랫폼별, 집단별로 세분화하여 분석합니다.
연령/성별/정치 성향/플랫폼별 반응 차이를 식별하고, Core(핵심 지지층), Opposition(반대층), Swing(유동층)으로 구분합니다.
각 집단의 특성과 영향력을 평가하여 전략적 인사이트를 제공합니다.
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

위 데이터를 기반으로 "${data.keyword}"에 대한 집단별 반응을 분석하세요:
1. 플랫폼별 반응 세분화 (플랫폼, 감정, 주요 토픽, 볼륨, 특성)
2. 집단별 반응 (Core/Opposition/Swing 구분, 특성, 감정, 영향력)
3. 가장 영향력 높은 집단과 그 이유`;
  },
};
