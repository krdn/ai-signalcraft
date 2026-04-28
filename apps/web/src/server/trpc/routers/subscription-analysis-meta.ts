/**
 * buildSubscriptionAnalysisMeta — 순수 헬퍼
 *
 * triggerSubscription mutation에서 collection_jobs에 저장할 appliedPreset/limits/options를
 * 구독 정보로부터 합성합니다. 외부 의존 없이 단위 테스트 가능하도록 별도 파일로 분리합니다.
 */

type TokenOptimization =
  | 'none'
  | 'light'
  | 'standard'
  | 'aggressive'
  | 'rag-light'
  | 'rag-standard'
  | 'rag-aggressive';

export type SubscriptionJobMeta = {
  appliedPreset: {
    slug: string;
    title: string;
    sources: Record<string, boolean>;
    limits: {
      naverArticles: number;
      youtubeVideos: number;
      communityPosts: number;
      commentsPerItem: number;
    };
    optimization: TokenOptimization;
    skippedModules: string[];
    enableItemAnalysis: boolean;
    customized: boolean;
  };
  limits: {
    naverArticles: number;
    youtubeVideos: number;
    communityPosts: number;
    commentsPerItem: number;
  };
  options: {
    subscriptionId: number;
    skipItemAnalysis: boolean;
    useCollectorLoader: boolean;
    tokenOptimization: TokenOptimization;
    sources: string[];
    runManipulation?: boolean;
  };
};

export function buildSubscriptionAnalysisMeta(
  sub: {
    keyword: string;
    sources?: string[] | null;
    limits?: Record<string, number> | null;
    options?: { enableManipulation?: boolean } | null;
  },
  args: {
    subscriptionId: number;
    optimizationPreset?: TokenOptimization;
  },
): SubscriptionJobMeta {
  const subscriptionSources = (sub.sources ?? []) as string[];
  const subscriptionLimits = (sub.limits ?? {}) as Record<string, number>;
  const tokenOptimization: TokenOptimization = args.optimizationPreset ?? 'rag-standard';

  const limits = {
    naverArticles: subscriptionLimits.naverArticles ?? subscriptionLimits.maxPerRun ?? 500,
    youtubeVideos: subscriptionLimits.youtubeVideos ?? subscriptionLimits.maxPerRun ?? 50,
    communityPosts: subscriptionLimits.communityPosts ?? subscriptionLimits.maxPerRun ?? 100,
    commentsPerItem: subscriptionLimits.commentsPerItem ?? 200,
  };

  const appliedPreset = {
    slug: '__subscription__',
    title: `구독 #${args.subscriptionId} (${sub.keyword})`,
    sources: subscriptionSources.reduce<Record<string, boolean>>((acc, s) => {
      acc[s] = true;
      return acc;
    }, {}),
    limits,
    optimization: tokenOptimization,
    skippedModules: [] as string[],
    enableItemAnalysis: false,
    customized: true,
  };

  return {
    appliedPreset,
    limits,
    options: {
      subscriptionId: args.subscriptionId,
      skipItemAnalysis: true,
      useCollectorLoader: true,
      tokenOptimization,
      sources: subscriptionSources,
      ...(sub.options?.enableManipulation === true && { runManipulation: true }),
    },
  };
}
