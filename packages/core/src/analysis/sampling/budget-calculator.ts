// 시계열 샘플링 예산 계산 — 기간별 구간 설정 + 토큰 예산 분배

interface PerBinConfig {
  min: number;
  max: number;
}

export interface PeriodConfig {
  intervalMs: number;
  articlesPerBin: PerBinConfig;
  commentsPerBin: PerBinConfig;
  videosPerBin: PerBinConfig;
}

export interface SamplingBudget {
  binCount: number;
  binIntervalMs: number;
  binBoundaries: Date[];
  targets: { articles: number; comments: number; videos: number };
  minimums: { articles: number; comments: number; videos: number };
}

// 기간별 자동 구간 설정 — 여론분석 기준 시간 해상도
const PERIOD_CONFIGS: Array<{ maxDays: number; config: PeriodConfig }> = [
  {
    maxDays: 1,
    config: {
      intervalMs: 4 * 3600_000,
      articlesPerBin: { min: 10, max: 60 },
      commentsPerBin: { min: 50, max: 300 },
      videosPerBin: { min: 2, max: 10 },
    },
  },
  {
    maxDays: 3,
    config: {
      intervalMs: 8 * 3600_000,
      articlesPerBin: { min: 10, max: 80 },
      commentsPerBin: { min: 50, max: 400 },
      videosPerBin: { min: 2, max: 10 },
    },
  },
  {
    maxDays: 14,
    config: {
      intervalMs: 24 * 3600_000,
      articlesPerBin: { min: 10, max: 100 },
      commentsPerBin: { min: 30, max: 400 },
      videosPerBin: { min: 2, max: 10 },
    },
  },
  {
    maxDays: 60,
    config: {
      intervalMs: 2 * 24 * 3600_000,
      articlesPerBin: { min: 10, max: 120 },
      commentsPerBin: { min: 30, max: 500 },
      videosPerBin: { min: 2, max: 10 },
    },
  },
];

/** 기간 → 구간 설정 자동 결정 */
export function resolvePeriodConfig(dateRange: { start: Date; end: Date }): PeriodConfig {
  const days = (dateRange.end.getTime() - dateRange.start.getTime()) / (24 * 3600_000);
  const match = PERIOD_CONFIGS.find((c) => days <= c.maxDays);
  return match?.config ?? PERIOD_CONFIGS[PERIOD_CONFIGS.length - 1].config;
}

/** 전체 샘플링 예산 계산 */
export function calculateBudget(params: {
  dateRange: { start: Date; end: Date };
  totalArticles: number;
  totalComments: number;
  totalVideos: number;
}): SamplingBudget {
  const config = resolvePeriodConfig(params.dateRange);

  const binIntervalMs = config.intervalMs;
  const rangeMs = params.dateRange.end.getTime() - params.dateRange.start.getTime();
  const binCount = Math.max(1, Math.ceil(rangeMs / binIntervalMs));

  // 구간 경계 생성
  const binBoundaries: Date[] = [];
  for (let i = 0; i <= binCount; i++) {
    binBoundaries.push(new Date(params.dateRange.start.getTime() + i * binIntervalMs));
  }

  // 대상 샘플 수 = min(실제 수집량, max * binCount)
  const targetArticles = Math.min(params.totalArticles, config.articlesPerBin.max * binCount);
  let targetComments = Math.min(params.totalComments, config.commentsPerBin.max * binCount);
  const targetVideos = Math.min(params.totalVideos, config.videosPerBin.max * binCount);

  // 토큰 예산 체크: 댓글 평균 40자 ≈ 10토큰, 기사 평균 200자 ≈ 50토큰, 영상 100자 ≈ 25토큰
  // 목표: 분석 입력 총 토큰 ≤ 200K (대형 컨텍스트 윈도우 모델 기준)
  const estimatedTokens = targetArticles * 50 + targetComments * 10 + targetVideos * 25;
  if (estimatedTokens > 200_000) {
    // 댓글 비율 축소로 조정 (댓글이 대량이므로 가장 효과적)
    const excess = estimatedTokens - 80_000;
    const commentsToReduce = Math.ceil(excess / 10);
    targetComments = Math.max(
      config.commentsPerBin.min * binCount,
      targetComments - commentsToReduce,
    );
  }

  return {
    binCount,
    binIntervalMs,
    binBoundaries,
    targets: { articles: targetArticles, comments: targetComments, videos: targetVideos },
    minimums: {
      articles: config.articlesPerBin.min,
      comments: config.commentsPerBin.min,
      videos: config.videosPerBin.min,
    },
  };
}
