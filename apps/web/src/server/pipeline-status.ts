// 파이프라인 상태 조회 공유 함수 — tRPC 라우터 + SSE Route에서 공유
/* eslint-disable import-x/order */
import { collectionJobs, analysisResults, analysisReports, getDb } from '@ai-signalcraft/core';
import { eq } from 'drizzle-orm';
/* eslint-enable import-x/order */

// 분석 모듈 한글 라벨 매핑
const MODULE_LABELS: Record<string, string> = {
  'sentiment-framing': '감정 프레이밍 (Sentiment Framing)',
  'macro-view': '거시 분석 (Macro View)',
  segmentation: '세그멘테이션 (Segmentation)',
  'message-impact': '메시지 임팩트 (Message Impact)',
  'risk-map': '리스크 맵 (Risk Map)',
  opportunity: '기회 발굴 (Opportunity)',
  strategy: '전략 제안 (Strategy)',
  'final-summary': '종합 요약 (Final Summary)',
  'approval-rating': '지지율 분석 (Approval Rating)',
  'frame-war': '프레임 전쟁 (Frame War)',
  'crisis-scenario': '위기 시나리오 (Crisis Scenario)',
  'win-simulation': '승리 시뮬레이션 (Win Simulation)',
};

const SOURCE_LABELS: Record<string, string> = {
  'naver-news': '네이버 뉴스',
  'youtube-videos': '유튜브',
  'youtube-comments': '유튜브 댓글',
  dcinside: 'DC갤러리',
  fmkorea: '에펨코리아',
  clien: '클리앙',
  naver: '네이버 뉴스',
  youtube: '유튜브',
};

const MODULE_STAGE: Record<string, number> = {
  'macro-view': 1,
  segmentation: 1,
  'sentiment-framing': 1,
  'message-impact': 1,
  'risk-map': 2,
  opportunity: 2,
  strategy: 2,
  'final-summary': 3,
  'approval-rating': 4,
  'frame-war': 4,
  'crisis-scenario': 4,
  'win-simulation': 4,
};

import { estimateCostUsd } from '@/components/analysis/pipeline-monitor/constants';

type SourceDetailStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled';

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

/**
 * jobId로 파이프라인 전체 상태를 조회하여 반환
 * 인증 없이 순수 쿼리만 수행 (인증은 호출자가 처리)
 */
export async function getPipelineStatus(jobId: number) {
  const db = getDb();

  // 1. collectionJobs
  const [job] = await db.select().from(collectionJobs).where(eq(collectionJobs.id, jobId));
  if (!job) return null;

  // 2. analysisResults
  const analysisRows = await db
    .select()
    .from(analysisResults)
    .where(eq(analysisResults.jobId, jobId));

  // 3. analysisReports (metadata에서 reportModel 추출)
  const [report] = await db
    .select({
      id: analysisReports.id,
      createdAt: analysisReports.createdAt,
      metadata: analysisReports.metadata,
    })
    .from(analysisReports)
    .where(eq(analysisReports.jobId, jobId))
    .limit(1);

  // --- 5단계 파이프라인 상태 파생 ---
  const isCancelled = job.status === 'cancelled';
  const isPaused = job.status === 'paused';
  const collectionDone = job.status === 'completed' || job.status === 'partial_failure';
  const collectionFailed = job.status === 'failed';
  const normalizationDone = collectionDone;
  const analysisStarted = analysisRows.length > 0;
  const analysisInProgress = analysisRows.some(
    (r) => r.status === 'running' || r.status === 'pending',
  );
  const analysisDone = analysisStarted && !analysisInProgress;
  const reportDone = !!report;

  // item-analysis 상태 파생 (progress JSONB에서)
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
  const itemAnalysisEnabled = !!(job as any).options?.enableItemAnalysis;
  const itemAnalysisDone = itemAnalysisProgress?.status === 'completed';
  const itemAnalysisRunning = itemAnalysisProgress?.status === 'running';
  const itemAnalysisSkipped = itemAnalysisProgress?.status === 'skipped' || !itemAnalysisEnabled;

  // cancelled 시: 완료되지 않은 단계는 모두 'cancelled'로 표시
  const pipelineStages: Record<string, { status: string }> = {
    collection: {
      status: collectionFailed
        ? ('failed' as const)
        : collectionDone
          ? ('completed' as const)
          : isCancelled
            ? ('cancelled' as const)
            : job.status === 'running'
              ? ('running' as const)
              : ('pending' as const),
    },
    normalization: {
      status: collectionFailed
        ? ('skipped' as const)
        : normalizationDone
          ? ('completed' as const)
          : isCancelled
            ? ('cancelled' as const)
            : ('pending' as const),
    },
    'token-optimization': {
      status: collectionFailed
        ? ('skipped' as const)
        : (() => {
            const tokenOptProgress = (job.progress as Record<string, any> | null)?.[
              'token-optimization'
            ] as { status: string } | undefined;
            if (!tokenOptProgress || tokenOptProgress.status === 'skipped')
              return 'skipped' as const;
            if (tokenOptProgress.status === 'completed') return 'completed' as const;
            if (tokenOptProgress.status === 'failed') return 'failed' as const;
            if (tokenOptProgress.status === 'running') return 'running' as const;
            if (isCancelled) return 'cancelled' as const;
            return 'pending' as const;
          })(),
    },
    'item-analysis': {
      status: collectionFailed
        ? ('skipped' as const)
        : itemAnalysisSkipped
          ? ('skipped' as const)
          : itemAnalysisDone
            ? ('completed' as const)
            : isCancelled
              ? ('cancelled' as const)
              : itemAnalysisRunning
                ? ('running' as const)
                : normalizationDone
                  ? ('pending' as const)
                  : ('pending' as const),
    },
    analysis: {
      status: collectionFailed
        ? ('skipped' as const)
        : analysisDone
          ? ('completed' as const)
          : isCancelled
            ? ('cancelled' as const)
            : analysisInProgress || analysisStarted
              ? ('running' as const)
              : ('pending' as const),
    },
    report: {
      status: collectionFailed
        ? ('skipped' as const)
        : reportDone
          ? ('completed' as const)
          : isCancelled
            ? ('cancelled' as const)
            : analysisDone
              ? // 분석 완료 + 리포트 없음: job이 이미 완료(completed/partial_failure)면 리포트 생성 실패
                collectionDone && job.status !== 'running'
                ? ('failed' as const)
                : ('running' as const)
              : ('pending' as const),
    },
  };

  // --- 소스별 수집 상세 (articleDetails/videoDetails 포함) ---
  const sourceDetails: Record<string, SourceDetailResult> = {};
  const progress = job.progress as Record<string, any> | null;
  if (progress) {
    for (const [key, val] of Object.entries(progress)) {
      if (key === '_events') continue; // appendJobEvent로 기록된 이벤트 배열은 건너뜀
      const label = SOURCE_LABELS[key] ?? key;
      const articles = val.articles ?? 0;
      const videos = val.videos ?? 0;
      const posts = val.posts ?? 0;
      const comments = val.comments ?? 0;
      const count = articles + videos + posts + comments;
      sourceDetails[key] = {
        status: (val.status as SourceDetailStatus) ?? 'pending',
        count,
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

  const errorDetails = job.errorDetails as Record<string, string> | null;
  if (errorDetails) {
    for (const [key] of Object.entries(errorDetails)) {
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

  // cancelled 시: 완료되지 않은 소스를 cancelled로 표시
  if (isCancelled) {
    for (const detail of Object.values(sourceDetails)) {
      if (detail.status === 'running' || detail.status === 'pending') {
        detail.status = 'cancelled' as SourceDetailStatus;
      }
    }
  }

  // --- 분석 모듈 ---
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

  // --- 토큰 집계 ---
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

  // --- 타임라인 ---
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

  // --- 이벤트 로그 합성 ---
  const events: Array<{ timestamp: string; level: 'info' | 'warn' | 'error'; message: string }> =
    [];
  events.push({
    timestamp: timeline.jobCreatedAt,
    level: 'info',
    message: `파이프라인 시작: "${job.keyword}" 분석`,
  });

  if (progress) {
    for (const [key, val] of Object.entries(progress)) {
      if (key === '_events') continue;
      const label = SOURCE_LABELS[key] ?? key;
      const arts = val.articles ?? 0;
      const vids = val.videos ?? 0;
      const psts = val.posts ?? 0;
      const cmts = val.comments ?? 0;

      // 소스 유형별 상세 건수 문자열 생성
      const parts: string[] = [];
      if (arts > 0) parts.push(`기사 ${arts}건`);
      if (vids > 0) parts.push(`영상 ${vids}건`);
      if (psts > 0) parts.push(`게시글 ${psts}건`);
      if (cmts > 0) parts.push(`댓글 ${cmts}건`);
      const detail = parts.length > 0 ? parts.join(', ') : '0건';

      if (val.status === 'completed') {
        events.push({
          timestamp: timeline.jobUpdatedAt,
          level: 'info',
          message: `${label} 수집 완료 (${detail})`,
        });
      } else if (val.status === 'failed') {
        events.push({
          timestamp: timeline.jobUpdatedAt,
          level: 'error',
          message: `${label} 수집 실패: ${errorDetails?.[key] ?? '알 수 없는 오류'}`,
        });
      } else if (val.status === 'running') {
        events.push({
          timestamp: timeline.jobCreatedAt,
          level: 'info',
          message: `${label} 수집 중... (현재 ${detail})`,
        });
      }
    }
  }

  if (isCancelled) {
    events.push({
      timestamp: timeline.jobUpdatedAt,
      level: 'warn',
      message: '파이프라인이 사용자에 의해 중지되었습니다',
    });
  } else if (isPaused) {
    events.push({
      timestamp: timeline.jobUpdatedAt,
      level: 'warn',
      message: '파이프라인이 일시정지 중입니다',
    });
  } else if (collectionDone) {
    const allSources = Object.values(sourceDetails);
    const totalArts = allSources.reduce((s, d) => s + d.articles, 0);
    const totalCmts = allSources.reduce((s, d) => s + d.comments, 0);
    const totalVids = allSources.reduce((s, d) => s + d.videos, 0);
    const totalPsts = allSources.reduce((s, d) => s + d.posts, 0);
    const summaryParts: string[] = [];
    if (totalArts > 0) summaryParts.push(`기사 ${totalArts}`);
    if (totalVids > 0) summaryParts.push(`영상 ${totalVids}`);
    if (totalPsts > 0) summaryParts.push(`게시글 ${totalPsts}`);
    if (totalCmts > 0) summaryParts.push(`댓글 ${totalCmts}`);
    const summaryStr = summaryParts.join(' + ');
    events.push({
      timestamp: timeline.jobUpdatedAt,
      level: job.status === 'partial_failure' ? 'warn' : 'info',
      message:
        job.status === 'partial_failure'
          ? `수집 부분 완료 (${summaryStr}, 일부 소스 실패)`
          : `수집 완료 (${summaryStr})`,
    });
  } else if (collectionFailed) {
    events.push({
      timestamp: timeline.jobUpdatedAt,
      level: 'error',
      message: '수집 실패 — 파이프라인 중단',
    });
  }

  for (const mod of analysisModulesDetailed) {
    const label = MODULE_LABELS[mod.module] ?? mod.module;
    const stageLabel = `Stage ${mod.stage}`;

    // 시작 이벤트
    if (mod.startedAt) {
      const providerInfo = mod.usage?.provider ? ` [${mod.usage.provider}/${mod.usage.model}]` : '';
      events.push({
        timestamp: mod.startedAt,
        level: 'info',
        message: `${label} 분석 시작 (${stageLabel})${providerInfo}`,
      });
    }

    // 완료 이벤트
    if (mod.status === 'completed' && mod.completedAt) {
      const infoParts: string[] = [];
      if (mod.usage?.model) infoParts.push(mod.usage.model);
      if (mod.usage)
        infoParts.push(`${(mod.usage.input + mod.usage.output).toLocaleString()} 토큰`);
      if (mod.durationSeconds != null) infoParts.push(`${mod.durationSeconds}초`);
      const infoStr = infoParts.length > 0 ? ` (${infoParts.join(', ')})` : '';
      events.push({
        timestamp: mod.completedAt,
        level: 'info',
        message: `${label} 분석 완료${infoStr}`,
      });
    } else if (mod.status === 'failed' && mod.completedAt) {
      events.push({
        timestamp: mod.completedAt,
        level: 'error',
        message: `${label} 분석 실패: ${mod.errorMessage ?? '알 수 없는 오류'}`,
      });
    }
  }

  if (reportDone && timeline.reportCompletedAt) {
    const reportMeta = report?.metadata as {
      reportModel?: { provider: string; model: string };
      totalTokens?: number;
    } | null;
    const reportModelStr = reportMeta?.reportModel
      ? ` [${reportMeta.reportModel.provider}/${reportMeta.reportModel.model}]`
      : '';
    const reportTokenStr = reportMeta?.totalTokens
      ? `, ${reportMeta.totalTokens.toLocaleString()} 토큰`
      : '';
    events.push({
      timestamp: timeline.reportCompletedAt,
      level: 'info',
      message: `종합 리포트 생성 완료${reportModelStr}${reportTokenStr ? ` (${reportTokenStr.slice(2)})` : ''}`,
    });
  }

  // Worker에서 appendJobEvent()로 기록한 이벤트를 병합
  const rawEvents = (progress as Record<string, any> | null)?._events;
  if (Array.isArray(rawEvents)) {
    for (const ev of rawEvents) {
      if (ev && ev.ts && ev.level && ev.msg) {
        events.push({ timestamp: ev.ts, level: ev.level, message: ev.msg });
      }
    }
  }

  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // --- 전체 진행률 (수집 중에도 진행률 반영) ---
  const sourceEntries = Object.values(sourceDetails);
  const totalSources = Math.max(sourceEntries.length, 1);

  // 수집 진행률: 완료 소스 + running 소스의 부분 진행률
  let collectionProgressValue: number;
  if (collectionFailed) {
    collectionProgressValue = 0;
  } else if (collectionDone) {
    collectionProgressValue = 40; // 수집 완료
  } else {
    // 수집 중: 소스별 가중 진행률
    let sourceProgress = 0;
    for (const src of sourceEntries) {
      if (src.status === 'completed') {
        sourceProgress += 1; // 완료 소스: 100%
      } else if (src.status === 'running' && src.count > 0) {
        // running 소스: 현재 건수 기반 추정 (목표 건수 모르므로 0.5로 근사)
        sourceProgress += 0.5;
      }
    }
    collectionProgressValue = (sourceProgress / totalSources) * 40;
  }

  // 분석 진행률
  const completedModulesCount = analysisRows.filter((r) => r.status === 'completed').length;
  const totalExpectedModules = 12; // 전체 분석 모듈 수 (고정)
  const analysisProgressValue = collectionFailed
    ? 0
    : analysisRows.length > 0
      ? (completedModulesCount / totalExpectedModules) * 50
      : 0;

  const reportProgress = reportDone ? 10 : 0;
  const overallProgress = Math.min(
    100,
    Math.round(collectionProgressValue + analysisProgressValue + reportProgress),
  );
  const elapsedSeconds = Math.floor((Date.now() - new Date(job.createdAt).getTime()) / 1000);

  return {
    status: job.status,
    progress: job.progress,
    errorDetails: job.errorDetails,
    keyword: job.keyword,
    costLimitUsd: (job as any).costLimitUsd ?? null,
    skippedModules: (job as any).skippedModules ?? [],
    pipelineStages,
    analysisModuleCount: { total: analysisRows.length, completed: completedModulesCount },
    hasReport: reportDone,
    sourceDetails,
    analysisModules,
    elapsedSeconds,
    overallProgress,
    tokenUsage,
    timeline,
    analysisModulesDetailed,
    events,
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
