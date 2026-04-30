// 파이프라인 상태 조회 공유 함수 — tRPC 라우터 + SSE Route에서 공유

import {
  collectionJobs,
  analysisResults,
  analysisReports,
  getDb,
  getWorkerStatus,
  getQueueStatus,
} from '@ai-signalcraft/core';
import { eq } from 'drizzle-orm';
import { MODULE_LABELS, SOURCE_LABELS, MODULE_STAGE, PIPELINE_STAGE_KEYS } from './labels';
import { buildEventLog } from './events';
import { estimateCostUsd } from '@/components/analysis/pipeline-monitor/constants';

const STALLED_THRESHOLD_MS = 10 * 60 * 1000; // 10분 이상 active → stalled 의심

let workerStatusCache: { data: any; ts: number } | null = null;
const WORKER_CACHE_TTL = 5_000;

async function getCachedWorkerStatus() {
  const now = Date.now();
  if (workerStatusCache && now - workerStatusCache.ts < WORKER_CACHE_TTL) {
    return workerStatusCache.data;
  }
  try {
    const [healthStatus, queueDetail] = await Promise.all([getWorkerStatus(), getQueueStatus()]);

    const enriched = healthStatus.map((q) => {
      const detail = queueDetail.queues.find((d) => d.name === q.queue);
      const stalledJobs = (detail?.jobs ?? [])
        .filter((j) => {
          if (j.state !== 'active' || !j.processedOn) return false;
          return now - j.processedOn > STALLED_THRESHOLD_MS;
        })
        .map((j) => ({
          queue: q.queue,
          bullmqId: j.id,
          name: j.name,
          dbJobId: j.dbJobId ?? null,
          elapsedSeconds: j.processedOn ? Math.round((now - j.processedOn) / 1000) : 0,
        }));

      return {
        queue: q.queue,
        health: stalledJobs.length > 0 && q.health !== 'down' ? ('warn' as const) : q.health,
        workerCount: q.workerCount,
        counts: {
          active: q.counts.active,
          waiting: q.counts.waiting,
          delayed: q.counts.delayed,
          failed: q.counts.failed,
        },
        stalledJobs,
        isPaused: q.isPaused,
      };
    });

    workerStatusCache = { data: enriched, ts: now };
    return enriched;
  } catch {
    return workerStatusCache?.data ?? null;
  }
}

export type SourceDetailStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export interface SourceDetailResult {
  status: SourceDetailStatus;
  count: number;
  articles: number;
  comments: number;
  videos: number;
  posts: number;
  label: string;
  articleDetails?: Array<{ title: string; status: string; comments: number }>;
  videoDetails?: Array<{ title: string; status: string; comments: number }>;
}

export async function getPipelineStatus(jobId: number) {
  const db = getDb();

  const [job] = await db.select().from(collectionJobs).where(eq(collectionJobs.id, jobId));
  if (!job) return null;

  const analysisRows = await db
    .select()
    .from(analysisResults)
    .where(eq(analysisResults.jobId, jobId));

  const [report] = await db
    .select({
      id: analysisReports.id,
      createdAt: analysisReports.createdAt,
      metadata: analysisReports.metadata,
    })
    .from(analysisReports)
    .where(eq(analysisReports.jobId, jobId))
    .limit(1);

  // 상태 파생
  const isCancelled = job.status === 'cancelled';
  const isPaused = job.status === 'paused';
  // BP 정지 시 — 정지된 단계 이전 단계는 모두 완료된 것으로 간주
  // (awaitStageGate는 stage 완료 후에 호출되므로 pausedAtStage 자체도 완료됨)
  const BP_STAGE_ORDER = [
    'collection',
    'normalize',
    'token-optimization',
    'item-analysis',
    'analysis-stage1',
    'analysis-stage2',
    'analysis-stage4',
  ];
  const pausedStageIdx = isPaused ? BP_STAGE_ORDER.indexOf(job.pausedAtStage ?? '') : -1;
  const isStageCompletedByBP = (bpStage: string): boolean => {
    if (pausedStageIdx < 0) return false;
    const idx = BP_STAGE_ORDER.indexOf(bpStage);
    return idx >= 0 && idx <= pausedStageIdx;
  };

  // progress 데이터로부터 단계 완료 여부 추론 (cancelled/paused 상태에서도 정확히 표시)
  const progressData = (job.progress ?? {}) as Record<string, any>;
  const SOURCE_KEYS = ['naver', 'youtube', 'dcinside', 'fmkorea', 'clien'] as const;
  const collectionByProgress = SOURCE_KEYS.some((k) => progressData[k]?.status === 'completed');
  // normalize는 별도 progress 키가 없으므로 collectionByProgress + 후속 단계 흔적으로 추론
  const tokenOptByProgress =
    progressData['token-optimization']?.status === 'completed' ||
    progressData['token-optimization']?.status === 'skipped';
  const itemAnalysisByProgress =
    progressData['item-analysis']?.status === 'completed' ||
    progressData['item-analysis']?.status === 'skipped';
  // 후속 단계가 시작됐다면 normalize는 완료된 것
  const normalizeByProgress =
    collectionByProgress && (tokenOptByProgress || itemAnalysisByProgress);

  const collectionDone =
    job.status === 'completed' ||
    job.status === 'partial_failure' ||
    isStageCompletedByBP('collection') ||
    collectionByProgress;
  const collectionFailed = job.status === 'failed';
  const normalizationDone =
    job.status === 'completed' ||
    job.status === 'partial_failure' ||
    isStageCompletedByBP('normalize') ||
    normalizeByProgress;
  const analysisStarted = analysisRows.length > 0;
  const analysisInProgress = analysisRows.some(
    (r) => r.status === 'running' || r.status === 'pending',
  );
  const analysisDone = analysisStarted && !analysisInProgress;
  const reportDone = !!report;

  // item-analysis 상태
  const itemAnalysisProgress = (job.progress as Record<string, any>)?.['item-analysis'] as
    | {
        status?: string;
        phase?: string;
        articlesTotal?: number;
        commentsTotal?: number;
        articlesAnalyzed?: number;
        commentsAnalyzed?: number;
        ambiguousCount?: number;
      }
    | undefined;
  const itemAnalysisEnabled = !!job.options?.enableItemAnalysis;
  const itemAnalysisDone = itemAnalysisProgress?.status === 'completed';
  const itemAnalysisRunning = itemAnalysisProgress?.status === 'running';
  const itemAnalysisSkipped = itemAnalysisProgress?.status === 'skipped' || !itemAnalysisEnabled;

  // 파이프라인 단계 상태
  const pipelineStages = derivePipelineStages({
    collectionFailed,
    collectionDone,
    isCancelled,
    isPaused,
    jobStatus: job.status,
    normalizationDone,
    itemAnalysisSkipped,
    itemAnalysisDone,
    itemAnalysisRunning,
    analysisDone,
    analysisInProgress,
    analysisStarted,
    reportDone,
    progress: job.progress as Record<string, any> | null,
  });

  // 소스별 수집 상세
  const sourceDetails = buildSourceDetails(
    job.progress as Record<string, any> | null,
    job.errorDetails as Record<string, string> | null,
    isCancelled,
  );

  // 분석 모듈
  const analysisModules = analysisRows.map((row) => ({
    module: row.module,
    status: row.status as 'pending' | 'running' | 'completed' | 'failed' | 'skipped',
    label: MODULE_LABELS[row.module] ?? row.module,
  }));

  const analysisModulesDetailed = analysisRows.map((row) => {
    const usage = row.usage as {
      inputTokens?: number;
      outputTokens?: number;
      provider?: string;
      model?: string;
    } | null;
    const startedAt = row.createdAt ? new Date(row.createdAt).toISOString() : null;
    const completedAt =
      (row.status === 'completed' || row.status === 'failed' || row.status === 'skipped') &&
      row.updatedAt
        ? new Date(row.updatedAt).toISOString()
        : null;
    const durationSeconds =
      startedAt && completedAt
        ? Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000)
        : null;

    return {
      module: row.module,
      label: MODULE_LABELS[row.module] ?? row.module,
      status: row.status as 'pending' | 'running' | 'completed' | 'failed' | 'skipped',
      stage: MODULE_STAGE[row.module] ?? 0,
      usage: usage
        ? {
            input: usage.inputTokens ?? 0,
            output: usage.outputTokens ?? 0,
            provider: usage.provider ?? '',
            model: usage.model ?? '',
          }
        : null,
      errorMessage: row.errorMessage ?? null,
      startedAt,
      completedAt,
      durationSeconds,
    };
  });

  // 토큰 집계
  let totalInput = 0,
    totalOutput = 0,
    totalCost = 0;
  const byModule: Array<{
    module: string;
    input: number;
    output: number;
    provider: string;
    model: string;
  }> = [];
  for (const mod of analysisModulesDetailed) {
    if (mod.usage && mod.usage.input + mod.usage.output > 0) {
      totalInput += mod.usage.input;
      totalOutput += mod.usage.output;
      totalCost += estimateCostUsd(mod.usage.input, mod.usage.output, mod.usage.model);
      byModule.push({
        module: mod.module,
        input: mod.usage.input,
        output: mod.usage.output,
        provider: mod.usage.provider,
        model: mod.usage.model,
      });
    }
  }
  const tokenUsage = {
    total: { input: totalInput, output: totalOutput },
    byModule,
    estimatedCostUsd: Math.round(totalCost * 10000) / 10000,
  };

  // 타임라인
  const analysisTimestamps = analysisRows
    .filter((r) => r.createdAt)
    .map((r) => new Date(r.createdAt!).getTime());
  const completedTimestamps = analysisRows
    .filter((r) => (r.status === 'completed' || r.status === 'failed') && r.updatedAt)
    .map((r) => new Date(r.updatedAt!).getTime());
  const timeline = {
    jobCreatedAt: new Date(job.createdAt).toISOString(),
    jobUpdatedAt: new Date(job.updatedAt).toISOString(),
    analysisStartedAt:
      analysisTimestamps.length > 0
        ? new Date(Math.min(...analysisTimestamps)).toISOString()
        : null,
    analysisCompletedAt:
      completedTimestamps.length > 0
        ? new Date(Math.max(...completedTimestamps)).toISOString()
        : null,
    reportCompletedAt: report?.createdAt ? new Date(report.createdAt).toISOString() : null,
  };

  // 워커 상태 (5초 캐시)
  const workerStatus = await getCachedWorkerStatus();

  // 이벤트 로그
  const reportMeta = report?.metadata as {
    reportModel?: { provider: string; model: string };
    totalTokens?: number;
  } | null;
  const events = buildEventLog({
    keyword: job.keyword,
    jobStatus: job.status,
    timeline,
    progress: job.progress as Record<string, any> | null,
    errorDetails: job.errorDetails as Record<string, string> | null,
    sourceDetails,
    analysisModulesDetailed,
    reportMeta,
    hasReport: reportDone,
    isCancelled,
    isPaused,
    collectionDone,
    collectionFailed,
  });

  // 파이프라인 단계별 처리 건수 (sampling / normalization / token-optimization)
  const pipelineStageDetails = buildPipelineStageDetails(
    job.progress as Record<string, any> | null,
  );

  // 진행률
  const overallProgress = calculateProgress(
    sourceDetails,
    analysisRows,
    collectionDone,
    collectionFailed,
    reportDone,
  );
  const completedModulesCount = analysisRows.filter((r) => r.status === 'completed').length;
  const elapsedSeconds = Math.floor((Date.now() - new Date(job.createdAt).getTime()) / 1000);

  return {
    status: job.status,
    progress: job.progress,
    errorDetails: job.errorDetails,
    keyword: job.keyword,
    costLimitUsd: job.costLimitUsd ?? null,
    skippedModules: job.skippedModules ?? [],
    pausedAt: job.pausedAt ? new Date(job.pausedAt).toISOString() : null,
    pausedAtStage: job.pausedAtStage ?? null,
    breakpoints: job.breakpoints ?? [],
    domain: job.domain ?? null,
    keywordType: job.keywordType ?? null,
    pipelineStages,
    pipelineStageDetails,
    analysisModuleCount: { total: analysisRows.length, completed: completedModulesCount },
    hasReport: reportDone,
    sourceDetails,
    reuseSummary: (job.progress as Record<string, any> | null)?._reuse ?? null,
    analysisModules,
    elapsedSeconds,
    overallProgress,
    tokenUsage,
    timeline,
    analysisModulesDetailed,
    events,
    workerStatus,
    itemAnalysis: itemAnalysisProgress
      ? {
          articlesTotal: itemAnalysisProgress.articlesTotal ?? 0,
          articlesAnalyzed: itemAnalysisProgress.articlesAnalyzed ?? 0,
          commentsTotal: itemAnalysisProgress.commentsTotal ?? 0,
          commentsAnalyzed: itemAnalysisProgress.commentsAnalyzed ?? 0,
          ambiguousCount: itemAnalysisProgress.ambiguousCount ?? 0,
          phase: (itemAnalysisProgress.phase as string) ?? 'pending',
          status: (itemAnalysisProgress.status as string) ?? 'pending',
        }
      : null,
  };
}

// --- 헬퍼 함수 ---

// 단위 테스트(__tests__/derive.test.ts)에서 fixture 기반 회귀 검증을 위해 export.
export function derivePipelineStages(params: {
  collectionFailed: boolean;
  collectionDone: boolean;
  isCancelled: boolean;
  isPaused: boolean;
  jobStatus: string;
  normalizationDone: boolean;
  itemAnalysisSkipped: boolean;
  itemAnalysisDone: boolean;
  itemAnalysisRunning: boolean;
  analysisDone: boolean;
  analysisInProgress: boolean;
  analysisStarted: boolean;
  reportDone: boolean;
  progress: Record<string, any> | null;
}) {
  const {
    collectionFailed,
    collectionDone,
    isCancelled,
    jobStatus,
    normalizationDone,
    itemAnalysisSkipped,
    itemAnalysisDone,
    itemAnalysisRunning,
    analysisDone,
    analysisInProgress,
    analysisStarted,
    reportDone,
    progress,
  } = params;

  return {
    collection: {
      status: collectionFailed
        ? 'failed'
        : collectionDone
          ? 'completed'
          : isCancelled
            ? 'cancelled'
            : jobStatus === 'running'
              ? 'running'
              : 'pending',
    },
    normalization: {
      status: collectionFailed
        ? 'skipped'
        : normalizationDone
          ? 'completed'
          : isCancelled
            ? 'cancelled'
            : 'pending',
    },
    'token-optimization': {
      status: collectionFailed
        ? 'skipped'
        : (() => {
            const p = progress?.['token-optimization'] as { status: string } | undefined;
            if (!p || p.status === 'skipped') return 'skipped';
            if (p.status === 'completed') return 'completed';
            if (p.status === 'failed') return 'failed';
            if (p.status === 'running') return 'running';
            if (isCancelled) return 'cancelled';
            return 'pending';
          })(),
    },
    'item-analysis': {
      status: collectionFailed
        ? 'skipped'
        : itemAnalysisSkipped
          ? 'skipped'
          : itemAnalysisDone
            ? 'completed'
            : isCancelled
              ? 'cancelled'
              : itemAnalysisRunning
                ? 'running'
                : 'pending',
    },
    analysis: {
      status: collectionFailed
        ? 'skipped'
        : analysisDone
          ? 'completed'
          : isCancelled
            ? 'cancelled'
            : analysisInProgress || analysisStarted
              ? 'running'
              : 'pending',
    },
    report: {
      status: collectionFailed
        ? 'skipped'
        : reportDone
          ? 'completed'
          : isCancelled
            ? 'cancelled'
            : (() => {
                const rp = progress?.report as { status?: string } | undefined;
                if (rp?.status === 'running') return 'running';
                if (rp?.status === 'failed') return 'failed';
                return analysisDone
                  ? collectionDone && jobStatus !== 'running'
                    ? 'failed'
                    : 'running'
                  : 'pending';
              })(),
    },
  };
}

export function buildSourceDetails(
  progress: Record<string, any> | null,
  errorDetails: Record<string, string> | null,
  isCancelled: boolean,
): Record<string, SourceDetailResult> {
  const sourceDetails: Record<string, SourceDetailResult> = {};
  if (progress) {
    for (const [key, val] of Object.entries(progress)) {
      if (key.startsWith('_') || PIPELINE_STAGE_KEYS.has(key)) continue;
      const label = SOURCE_LABELS[key] ?? key;
      const articles = val.articles ?? 0;
      const videos = val.videos ?? 0;
      const posts = val.posts ?? 0;
      const comments = val.comments ?? 0;
      sourceDetails[key] = {
        status: (val.status as SourceDetailStatus) ?? 'pending',
        count: articles + videos + posts + comments,
        articles,
        comments,
        videos,
        posts,
        label,
        articleDetails: val.articleDetails ?? undefined,
        videoDetails: val.videoDetails ?? undefined,
      };
    }
  }

  if (errorDetails) {
    for (const key of Object.keys(errorDetails)) {
      if (sourceDetails[key]) {
        sourceDetails[key].status = 'failed';
      } else {
        sourceDetails[key] = {
          status: 'failed',
          count: 0,
          articles: 0,
          comments: 0,
          videos: 0,
          posts: 0,
          label: SOURCE_LABELS[key] ?? key,
        };
      }
    }
  }

  if (isCancelled) {
    for (const detail of Object.values(sourceDetails)) {
      if (detail.status === 'running' || detail.status === 'pending') {
        detail.status = 'cancelled' as SourceDetailStatus;
      }
    }
  }

  return sourceDetails;
}

export function calculateProgress(
  sourceDetails: Record<string, SourceDetailResult>,
  analysisRows: any[],
  collectionDone: boolean,
  collectionFailed: boolean,
  reportDone: boolean,
): number {
  const sourceEntries = Object.values(sourceDetails);
  const totalSources = Math.max(sourceEntries.length, 1);

  let collectionProgressValue: number;
  if (collectionFailed) {
    collectionProgressValue = 0;
  } else if (collectionDone) {
    collectionProgressValue = 40;
  } else {
    let sourceProgress = 0;
    for (const src of sourceEntries) {
      if (src.status === 'completed') sourceProgress += 1;
      else if (src.status === 'running' && src.count > 0) sourceProgress += 0.5;
    }
    collectionProgressValue = (sourceProgress / totalSources) * 40;
  }

  const completedModulesCount = analysisRows.filter((r: any) => r.status === 'completed').length;
  const totalExpectedModules = 12;
  const analysisProgressValue = collectionFailed
    ? 0
    : analysisRows.length > 0
      ? (completedModulesCount / totalExpectedModules) * 50
      : 0;

  const reportProgress = reportDone ? 10 : 0;
  return Math.min(
    100,
    Math.round(collectionProgressValue + analysisProgressValue + reportProgress),
  );
}

export interface PipelineStageDetail {
  sampling: {
    status: string;
    articles: { totalInput: number; totalSampled: number };
    comments: { totalInput: number; totalSampled: number };
    videos: { totalInput: number; totalSampled: number };
  } | null;
  normalization: {
    status: string;
    articlesProcessed: number;
    commentsProcessed: number;
    totalMatches: number;
    elapsedMs: number;
  } | null;
  tokenOptimization: {
    status: string;
    preset: string;
    originalArticles: number;
    optimizedArticles: number;
    originalComments: number;
    optimizedComments: number;
    reductionPercent?: number;
  } | null;
}

function buildPipelineStageDetails(progress: Record<string, any> | null): PipelineStageDetail {
  if (!progress) {
    return { sampling: null, normalization: null, tokenOptimization: null };
  }

  const s = progress['sampling'];
  const sampling = s
    ? {
        status: s.status ?? 'completed',
        articles: {
          totalInput: s.articles?.totalInput ?? 0,
          totalSampled: s.articles?.totalSampled ?? 0,
        },
        comments: {
          totalInput: s.comments?.totalInput ?? 0,
          totalSampled: s.comments?.totalSampled ?? 0,
        },
        videos: {
          totalInput: s.videos?.totalInput ?? 0,
          totalSampled: s.videos?.totalSampled ?? 0,
        },
      }
    : null;

  const n = progress['normalization'];
  const normalization = n
    ? {
        status: n.status ?? 'pending',
        articlesProcessed: n.articlesProcessed ?? 0,
        commentsProcessed: n.commentsProcessed ?? 0,
        totalMatches: n.totalMatches ?? 0,
        elapsedMs: n.elapsedMs ?? 0,
      }
    : null;

  const t = progress['token-optimization'];
  const tokenOptimization =
    t && t.status !== 'skipped'
      ? {
          status: t.status ?? 'pending',
          preset: t.preset ?? '',
          originalArticles: t.originalArticles ?? 0,
          optimizedArticles: t.optimizedArticles ?? 0,
          originalComments: t.originalComments ?? 0,
          optimizedComments: t.optimizedComments ?? 0,
          reductionPercent: t.reductionPercent,
        }
      : null;

  return { sampling, normalization, tokenOptimization };
}
