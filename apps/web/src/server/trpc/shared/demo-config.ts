// 데모 계정 기본 설정 — 단일 소스 (demo-auth, analysis 라우터에서 공유)
export const DEMO_DEFAULTS = {
  dailyLimit: 5,
  allowedModules: ['macroView', 'segmentation', 'sentimentFraming'] as string[],
  maxCollectionLimits: {
    naverArticles: 30,
    youtubeVideos: 5,
    communityPosts: 10,
    commentsPerItem: 30,
  },
  expiryDays: 7,
  costLimitUsd: 0.5,
};

export type DemoCollectionLimits = typeof DEMO_DEFAULTS.maxCollectionLimits;

// 전체 분석 모듈 목록 (데모 스킵 계산용)
export const ALL_ANALYSIS_MODULES: string[] = [
  'macroView',
  'segmentation',
  'sentimentFraming',
  'messageImpact',
  'riskMap',
  'opportunity',
  'strategy',
  'finalSummary',
  'approvalRating',
  'frameWar',
  'crisisScenario',
  'winSimulation',
];
