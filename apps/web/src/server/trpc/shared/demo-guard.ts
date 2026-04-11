import { TRPCError } from '@trpc/server';
import { demoQuotas } from '@ai-signalcraft/core';
import { eq } from 'drizzle-orm';
import { DEMO_DEFAULTS, ALL_ANALYSIS_MODULES, type DemoCollectionLimits } from './demo-config';

type CollectionLimits = {
  naverArticles: number;
  youtubeVideos: number;
  communityPosts: number;
  commentsPerItem: number;
};

type TriggerOptions = {
  enableItemAnalysis?: boolean;
  tokenOptimization?:
    | 'none'
    | 'light'
    | 'standard'
    | 'aggressive'
    | 'rag-light'
    | 'rag-standard'
    | 'rag-aggressive';
};

export type DemoGuardResult = {
  effectiveLimits: CollectionLimits;
  effectiveOptions: TriggerOptions;
  skippedModules: string[];
  costLimitUsd: number;
};

// 데모 사용자 쿼터 검증 + 제한 적용 — 쿼터 카운트 증가 포함
export async function applyDemoGuard(
  db: any,
  userId: string,
  requestedLimits: CollectionLimits | null,
  requestedOptions: TriggerOptions | null,
): Promise<DemoGuardResult> {
  const [quota] = await db.select().from(demoQuotas).where(eq(demoQuotas.userId, userId)).limit(1);

  if (!quota) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '데모 쿼터 정보가 없습니다' });
  }
  if (quota.expiresAt < new Date()) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: '데모 체험 기간이 만료되었습니다. 정식 가입 후 이용해 주세요.',
    });
  }

  // 일일 횟수 체크
  const today = new Date().toISOString().slice(0, 10);
  const todayUsed = quota.todayDate === today ? quota.todayUsed : 0;
  if (todayUsed >= quota.dailyLimit) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `오늘 분석 횟수(${quota.dailyLimit}회)를 모두 사용했습니다. 내일 다시 시도하거나 정식 가입 후 이용해 주세요.`,
    });
  }

  // 수집 한도 클램핑
  const demoLimits =
    (quota.maxCollectionLimits as DemoCollectionLimits) ?? DEMO_DEFAULTS.maxCollectionLimits;
  const effectiveLimits: CollectionLimits = {
    naverArticles: Math.min(
      requestedLimits?.naverArticles ?? demoLimits.naverArticles,
      demoLimits.naverArticles,
    ),
    youtubeVideos: Math.min(
      requestedLimits?.youtubeVideos ?? demoLimits.youtubeVideos,
      demoLimits.youtubeVideos,
    ),
    communityPosts: Math.min(
      requestedLimits?.communityPosts ?? demoLimits.communityPosts,
      demoLimits.communityPosts,
    ),
    commentsPerItem: Math.min(
      requestedLimits?.commentsPerItem ?? demoLimits.commentsPerItem,
      demoLimits.commentsPerItem,
    ),
  };

  // 토큰 최적화 강제 + 허용 모듈 외 스킵
  const effectiveOptions: TriggerOptions = {
    ...requestedOptions,
    tokenOptimization: 'aggressive',
  };
  const allowed = (quota.allowedModules as string[]) ?? DEMO_DEFAULTS.allowedModules;
  const skippedModules = ALL_ANALYSIS_MODULES.filter((m) => !allowed.includes(m));

  // 쿼터 사용 카운트 증가
  await db
    .update(demoQuotas)
    .set({
      todayUsed: todayUsed + 1,
      todayDate: today,
      totalUsed: quota.totalUsed + 1,
    })
    .where(eq(demoQuotas.userId, userId));

  return {
    effectiveLimits,
    effectiveOptions,
    skippedModules,
    costLimitUsd: DEMO_DEFAULTS.costLimitUsd,
  };
}
