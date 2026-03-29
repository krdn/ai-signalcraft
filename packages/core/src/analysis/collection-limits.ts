// 수집 한도 기본값 설정 — DB 기반 CRUD
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { concurrencySettings, type CollectionLimits } from '../db/schema/settings';
import { DEFAULT_PROVIDER_CONCURRENCY } from './concurrency-config';

export type { CollectionLimits } from '../db/schema/settings';

// 기본값 (DB에 설정이 없을 때 폴백)
export const DEFAULT_COLLECTION_LIMITS: CollectionLimits = {
  naverArticles: 500,
  youtubeVideos: 50,
  communityPosts: 50,
  commentsPerItem: 500,
};

/** 수집 한도 기본값 조회 */
export async function getCollectionLimits(): Promise<CollectionLimits> {
  const db = getDb();
  const rows = await db.select({ collectionLimits: concurrencySettings.collectionLimits })
    .from(concurrencySettings).limit(1);

  if (rows.length === 0 || !rows[0].collectionLimits) {
    return { ...DEFAULT_COLLECTION_LIMITS };
  }
  return rows[0].collectionLimits;
}

/** 수집 한도 기본값 업데이트 */
export async function updateCollectionLimits(
  limits: Partial<CollectionLimits>,
): Promise<CollectionLimits> {
  const db = getDb();
  const current = await getCollectionLimits();
  const merged: CollectionLimits = {
    naverArticles: limits.naverArticles ?? current.naverArticles,
    youtubeVideos: limits.youtubeVideos ?? current.youtubeVideos,
    communityPosts: limits.communityPosts ?? current.communityPosts,
    commentsPerItem: limits.commentsPerItem ?? current.commentsPerItem,
  };

  const rows = await db.select({ id: concurrencySettings.id }).from(concurrencySettings).limit(1);

  if (rows.length === 0) {
    // concurrency_settings 행이 없으면 기본값과 함께 생성
    await db.insert(concurrencySettings).values({
      providerConcurrency: DEFAULT_PROVIDER_CONCURRENCY,
      collectionLimits: merged,
    });
  } else {
    await db.update(concurrencySettings)
      .set({ collectionLimits: merged, updatedAt: new Date() })
      .where(eq(concurrencySettings.id, rows[0].id));
  }

  return merged;
}
