// 델타 분석 오케스트레이터 — 시리즈 내 이전/현재 job 비교 분석
import { eq, and, desc, lt, sql } from 'drizzle-orm';
import { getDb } from '../../db';
import { collectionJobs } from '../../db/schema/collections';
import { analysisResults } from '../../db/schema/analysis';
import { analysisSeries } from '../../db/schema/series';
import { appendJobEvent } from '../../pipeline/persist';
import type { SentimentFramingResult } from '../schemas/sentiment-framing.schema';
import type { MacroViewResult } from '../schemas/macro-view.schema';
import {
  computeQuantitativeDelta,
  type ModuleResults,
  type CollectionStats,
} from './compute-delta';
import { interpretDelta } from './interpret-delta';
import { persistDeltaResult, updateSeriesMetadata } from './persist-delta';

/**
 * 특정 job의 분석 모듈 결과 로드
 */
async function loadModuleResults(jobId: number): Promise<Partial<ModuleResults>> {
  const db = getDb();

  const rows = await db
    .select({ module: analysisResults.module, result: analysisResults.result })
    .from(analysisResults)
    .where(and(eq(analysisResults.jobId, jobId), eq(analysisResults.status, 'completed')));

  const resultMap: Partial<ModuleResults> = {};

  for (const row of rows) {
    if (row.module === 'sentiment-framing' && row.result) {
      resultMap.sentimentFraming = row.result as SentimentFramingResult;
    } else if (row.module === 'macro-view' && row.result) {
      resultMap.macroView = row.result as MacroViewResult;
    }
  }

  return resultMap;
}

/**
 * article_jobs / comment_jobs에서 새 항목 수 계산
 */
async function countNewItems(
  currentJobId: number,
  previousJobId: number,
): Promise<{
  newArticles: number;
  newComments: number;
  totalArticles: number;
  totalComments: number;
}> {
  const db = getDb();

  // 현재 job에만 있고 이전 job에는 없는 기사 수
  const articleResult = await db.execute<{
    new_count: string | null;
    total_count: string | null;
  }>(sql`
    SELECT
      COUNT(DISTINCT aj_curr.article_id) FILTER (WHERE aj_prev.article_id IS NULL) as new_count,
      COUNT(DISTINCT aj_curr.article_id) as total_count
    FROM article_jobs aj_curr
    LEFT JOIN article_jobs aj_prev
      ON aj_prev.article_id = aj_curr.article_id
      AND aj_prev.job_id = ${previousJobId}
    WHERE aj_curr.job_id = ${currentJobId}
  `);

  const commentResult = await db.execute<{
    new_count: string | null;
    total_count: string | null;
  }>(sql`
    SELECT
      COUNT(DISTINCT cj_curr.comment_id) FILTER (WHERE cj_prev.comment_id IS NULL) as new_count,
      COUNT(DISTINCT cj_curr.comment_id) as total_count
    FROM comment_jobs cj_curr
    LEFT JOIN comment_jobs cj_prev
      ON cj_prev.comment_id = cj_curr.comment_id
      AND cj_prev.job_id = ${previousJobId}
    WHERE cj_curr.job_id = ${currentJobId}
  `);

  const articleRow = articleResult.rows[0];
  const commentRow = commentResult.rows[0];

  return {
    newArticles: Number(articleRow?.new_count ?? 0),
    totalArticles: Number(articleRow?.total_count ?? 0),
    newComments: Number(commentRow?.new_count ?? 0),
    totalComments: Number(commentRow?.total_count ?? 0),
  };
}

/**
 * 시리즈 델타 분석 실행
 * @param seriesId 분석 시리즈 ID
 * @param currentJobId 현재 수집 작업 ID
 */
export async function runSeriesDeltaAnalysis(
  seriesId: number,
  currentJobId: number,
): Promise<void> {
  const db = getDb();

  // 1. analysisSeries에서 시리즈 조회
  const [series] = await db
    .select()
    .from(analysisSeries)
    .where(eq(analysisSeries.id, seriesId))
    .limit(1);

  if (!series) {
    await appendJobEvent(currentJobId, 'warn', `델타 분석: 시리즈 ${seriesId}를 찾을 수 없음`);
    return;
  }

  // 2. collectionJobs에서 현재 job의 seriesOrder 조회
  const [currentJob] = await db
    .select({
      id: collectionJobs.id,
      seriesOrder: collectionJobs.seriesOrder,
      startDate: collectionJobs.startDate,
      endDate: collectionJobs.endDate,
    })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, currentJobId))
    .limit(1);

  if (!currentJob || currentJob.seriesOrder == null) {
    await appendJobEvent(
      currentJobId,
      'warn',
      `델타 분석: job ${currentJobId}에 seriesOrder가 없음 — 스킵`,
    );
    await updateSeriesMetadata(seriesId, currentJobId);
    return;
  }

  // 3. 같은 시리즈에서 seriesOrder < 현재 & status='completed'인 가장 최근 job
  const [previousJob] = await db
    .select({
      id: collectionJobs.id,
      seriesOrder: collectionJobs.seriesOrder,
      startDate: collectionJobs.startDate,
      endDate: collectionJobs.endDate,
    })
    .from(collectionJobs)
    .where(
      and(
        eq(collectionJobs.seriesId, seriesId),
        eq(collectionJobs.status, 'completed'),
        lt(collectionJobs.seriesOrder, currentJob.seriesOrder),
      ),
    )
    .orderBy(desc(collectionJobs.seriesOrder))
    .limit(1);

  // 4. 이전 job 없으면 → updateSeriesMetadata만 호출 후 return
  if (!previousJob) {
    await appendJobEvent(
      currentJobId,
      'info',
      `델타 분석: 시리즈 ${seriesId}의 첫 번째 완료 job — 델타 계산 스킵`,
    );
    await updateSeriesMetadata(seriesId, currentJobId);
    return;
  }

  // 5. 이전/현재 job의 분석 모듈 결과 로드
  const [currentModuleResults, previousModuleResults] = await Promise.all([
    loadModuleResults(currentJobId),
    loadModuleResults(previousJob.id),
  ]);

  // 6. 필수 모듈 결과 없으면 → warning event + return
  if (
    !currentModuleResults.sentimentFraming ||
    !currentModuleResults.macroView ||
    !previousModuleResults.sentimentFraming ||
    !previousModuleResults.macroView
  ) {
    const missing: string[] = [];
    if (!currentModuleResults.sentimentFraming) missing.push(`현재 job sentiment-framing`);
    if (!currentModuleResults.macroView) missing.push(`현재 job macro-view`);
    if (!previousModuleResults.sentimentFraming) missing.push(`이전 job sentiment-framing`);
    if (!previousModuleResults.macroView) missing.push(`이전 job macro-view`);

    await appendJobEvent(
      currentJobId,
      'warn',
      `델타 분석: 필수 모듈 결과 누락 (${missing.join(', ')}) — 스킵`,
    );
    await updateSeriesMetadata(seriesId, currentJobId);
    return;
  }

  const before: ModuleResults = {
    sentimentFraming: previousModuleResults.sentimentFraming,
    macroView: previousModuleResults.macroView,
  };

  const after: ModuleResults = {
    sentimentFraming: currentModuleResults.sentimentFraming,
    macroView: currentModuleResults.macroView,
  };

  // 7. 새 항목 수 계산
  const collectionStats: CollectionStats = await countNewItems(currentJobId, previousJob.id);

  // 8. computeQuantitativeDelta 호출
  const quantDelta = computeQuantitativeDelta(before, after, collectionStats);

  // 9. appendJobEvent로 델타 요약 기록
  await appendJobEvent(
    currentJobId,
    'info',
    `델타 분석 완료: 감성 긍정 ${(quantDelta.sentiment.delta.positive * 100).toFixed(1)}%p, 언급량 ${quantDelta.mentions.deltaPercent > 0 ? '+' : ''}${quantDelta.mentions.deltaPercent}%, 새 키워드 ${quantDelta.keywords.appeared.length}개`,
  );

  // 10. interpretDelta 호출 (try/catch, 실패 시 정량만 저장)
  let interpretation;
  let usage;

  try {
    const currentDateRange = {
      start: currentJob.startDate.toISOString().split('T')[0],
      end: currentJob.endDate.toISOString().split('T')[0],
    };
    const previousDateRange = {
      start: previousJob.startDate.toISOString().split('T')[0],
      end: previousJob.endDate.toISOString().split('T')[0],
    };

    const interpretResult = await interpretDelta(
      series.keyword,
      quantDelta,
      currentDateRange,
      previousDateRange,
    );

    interpretation = interpretResult.interpretation;
    usage = interpretResult.usage;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await appendJobEvent(
      currentJobId,
      'warn',
      `델타 해석 LLM 호출 실패 (정량 데이터만 저장): ${errMsg}`,
    );
  }

  // 11. persistDeltaResult + updateSeriesMetadata
  await persistDeltaResult({
    seriesId,
    jobId: currentJobId,
    previousJobId: previousJob.id,
    quantitativeDelta: quantDelta,
    qualitativeInterpretation: interpretation,
    usage,
  });

  await updateSeriesMetadata(seriesId, currentJobId);
}
