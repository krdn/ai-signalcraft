// 델타 분석 결과 DB 저장
import { eq } from 'drizzle-orm';
import { getDb } from '../../db';
import { seriesDeltaResults, analysisSeries } from '../../db/schema/series';
import type { QuantitativeDelta, QualitativeInterpretation } from './delta-schema';

interface PersistDeltaParams {
  seriesId: number;
  jobId: number;
  previousJobId: number;
  quantitativeDelta: QuantitativeDelta;
  qualitativeInterpretation?: QualitativeInterpretation;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    provider: string;
    model: string;
  };
}

/**
 * seriesDeltaResults에 upsert (seriesId+jobId 충돌 시 업데이트)
 */
export async function persistDeltaResult(params: PersistDeltaParams): Promise<void> {
  const db = getDb();
  const { seriesId, jobId, previousJobId, quantitativeDelta, qualitativeInterpretation, usage } =
    params;

  await db
    .insert(seriesDeltaResults)
    .values({
      seriesId,
      jobId,
      previousJobId,
      quantitativeDelta,
      qualitativeInterpretation: qualitativeInterpretation ?? null,
      usage: usage ?? null,
    })
    .onConflictDoUpdate({
      target: [seriesDeltaResults.seriesId, seriesDeltaResults.jobId],
      set: {
        previousJobId,
        quantitativeDelta,
        qualitativeInterpretation: qualitativeInterpretation ?? null,
        usage: usage ?? null,
      },
    });
}

/**
 * analysisSeries.metadata 업데이트 (totalJobs, lastJobId, lastAnalyzedAt)
 */
export async function updateSeriesMetadata(seriesId: number, jobId: number): Promise<void> {
  const db = getDb();

  // 현재 totalJobs 조회 후 증가
  const [series] = await db
    .select({ metadata: analysisSeries.metadata })
    .from(analysisSeries)
    .where(eq(analysisSeries.id, seriesId))
    .limit(1);

  const currentTotal = series?.metadata?.totalJobs ?? 0;

  await db
    .update(analysisSeries)
    .set({
      metadata: {
        totalJobs: currentTotal + 1,
        lastJobId: jobId,
        lastAnalyzedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    })
    .where(eq(analysisSeries.id, seriesId));
}
