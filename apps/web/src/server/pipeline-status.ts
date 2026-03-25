// 파이프라인 상태 조회 공유 함수 — tRPC 라우터 + SSE Route에서 공유
import { collectionJobs, analysisResults, analysisReports, getDb } from '@ai-signalcraft/core';
import { eq } from 'drizzle-orm';

// 분석 모듈 한글 라벨 매핑
const MODULE_LABELS: Record<string, string> = {
  'sentiment-framing': '감정 프레이밍',
  'macro-view': '거시 분석',
  'segmentation': '세그멘테이션',
  'message-impact': '메시지 임팩트',
  'risk-map': '리스크 맵',
  'opportunity': '기회 발굴',
  'strategy': '전략 제안',
  'final-summary': '종합 요약',
  'approval-rating': '지지율 분석',
  'frame-war': '프레임 전쟁',
  'crisis-scenario': '위기 시나리오',
  'win-simulation': '승리 시뮬레이션',
};

const SOURCE_LABELS: Record<string, string> = {
  'naver-news': '네이버 뉴스',
  'youtube-videos': '유튜브',
  'youtube-comments': '유튜브 댓글',
  'dcinside': 'DC갤러리',
  'fmkorea': '에펨코리아',
  'clien': '클리앙',
  'naver': '네이버 뉴스',
  'youtube': '유튜브',
};

const MODULE_STAGE: Record<string, number> = {
  'macro-view': 1, 'segmentation': 1, 'sentiment-framing': 1, 'message-impact': 1,
  'risk-map': 2, 'opportunity': 2, 'strategy': 2,
  'final-summary': 3,
  'approval-rating': 4, 'frame-war': 4, 'crisis-scenario': 4, 'win-simulation': 4,
};

const TOKEN_COST_PER_1K: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
};

function estimateCost(inputTokens: number, outputTokens: number, model: string): number {
  const cost = TOKEN_COST_PER_1K[model];
  if (!cost) return 0;
  return (inputTokens / 1000) * cost.input + (outputTokens / 1000) * cost.output;
}

type SourceDetailStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface SourceDetailResult {
  status: SourceDetailStatus;
  count: number;
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
  const analysisRows = await db.select().from(analysisResults).where(eq(analysisResults.jobId, jobId));

  // 3. analysisReports
  const [report] = await db.select({ id: analysisReports.id, createdAt: analysisReports.createdAt })
    .from(analysisReports).where(eq(analysisReports.jobId, jobId)).limit(1);

  // --- 4단계 파이프라인 상태 파생 ---
  const collectionDone = job.status === 'completed' || job.status === 'partial_failure';
  const collectionFailed = job.status === 'failed';
  const normalizationDone = collectionDone;
  const analysisStarted = analysisRows.length > 0;
  const analysisInProgress = analysisRows.some(r => r.status === 'running' || r.status === 'pending');
  const analysisDone = analysisStarted && !analysisInProgress;
  const reportDone = !!report;

  const pipelineStages = {
    collection: {
      status: collectionFailed ? 'failed' as const
        : collectionDone ? 'completed' as const
        : job.status === 'running' ? 'running' as const
        : 'pending' as const,
    },
    normalization: {
      status: collectionFailed ? 'skipped' as const : normalizationDone ? 'completed' as const : 'pending' as const,
    },
    analysis: {
      status: collectionFailed ? 'skipped' as const
        : analysisDone ? 'completed' as const
        : analysisInProgress || analysisStarted ? 'running' as const
        : 'pending' as const,
    },
    report: {
      status: collectionFailed ? 'skipped' as const
        : reportDone ? 'completed' as const
        : analysisDone ? 'running' as const
        : 'pending' as const,
    },
  };

  // --- 소스별 수집 상세 (articleDetails/videoDetails 포함) ---
  const sourceDetails: Record<string, SourceDetailResult> = {};
  const progress = job.progress as Record<string, any> | null;
  if (progress) {
    for (const [key, val] of Object.entries(progress)) {
      const label = SOURCE_LABELS[key] ?? key;
      const count = (val.articles ?? 0) + (val.videos ?? 0) + (val.posts ?? 0) + (val.comments ?? 0);
      sourceDetails[key] = {
        status: (val.status as SourceDetailStatus) ?? 'pending',
        count,
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
        sourceDetails[key] = { status: 'failed', count: 0, label: SOURCE_LABELS[key] ?? key };
      }
    }
  }

  // --- 분석 모듈 ---
  const analysisModules = analysisRows.map(row => ({
    module: row.module,
    status: row.status as 'pending' | 'running' | 'completed' | 'failed',
    label: MODULE_LABELS[row.module] ?? row.module,
  }));

  const analysisModulesDetailed = analysisRows.map(row => {
    const usage = row.usage as { inputTokens?: number; outputTokens?: number; provider?: string; model?: string } | null;
    const startedAt = row.createdAt ? new Date(row.createdAt).toISOString() : null;
    const completedAt = (row.status === 'completed' || row.status === 'failed') && row.updatedAt
      ? new Date(row.updatedAt).toISOString() : null;
    const durationSeconds = startedAt && completedAt
      ? Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000) : null;

    return {
      module: row.module,
      label: MODULE_LABELS[row.module] ?? row.module,
      status: row.status as 'pending' | 'running' | 'completed' | 'failed',
      stage: MODULE_STAGE[row.module] ?? 0,
      usage: usage ? {
        input: usage.inputTokens ?? 0, output: usage.outputTokens ?? 0,
        provider: usage.provider ?? '', model: usage.model ?? '',
      } : null,
      errorMessage: row.errorMessage ?? null,
      startedAt, completedAt, durationSeconds,
    };
  });

  // --- 토큰 집계 ---
  let totalInput = 0, totalOutput = 0, totalCost = 0;
  const byModule: Array<{ module: string; input: number; output: number; provider: string; model: string }> = [];
  for (const mod of analysisModulesDetailed) {
    if (mod.usage && mod.usage.input + mod.usage.output > 0) {
      totalInput += mod.usage.input;
      totalOutput += mod.usage.output;
      totalCost += estimateCost(mod.usage.input, mod.usage.output, mod.usage.model);
      byModule.push({ module: mod.module, input: mod.usage.input, output: mod.usage.output, provider: mod.usage.provider, model: mod.usage.model });
    }
  }
  const tokenUsage = { total: { input: totalInput, output: totalOutput }, byModule, estimatedCostUsd: Math.round(totalCost * 10000) / 10000 };

  // --- 타임라인 ---
  const analysisTimestamps = analysisRows.filter(r => r.createdAt).map(r => new Date(r.createdAt!).getTime());
  const completedTimestamps = analysisRows.filter(r => (r.status === 'completed' || r.status === 'failed') && r.updatedAt).map(r => new Date(r.updatedAt!).getTime());
  const timeline = {
    jobCreatedAt: new Date(job.createdAt).toISOString(),
    jobUpdatedAt: new Date(job.updatedAt).toISOString(),
    analysisStartedAt: analysisTimestamps.length > 0 ? new Date(Math.min(...analysisTimestamps)).toISOString() : null,
    analysisCompletedAt: completedTimestamps.length > 0 ? new Date(Math.max(...completedTimestamps)).toISOString() : null,
    reportCompletedAt: report?.createdAt ? new Date(report.createdAt).toISOString() : null,
  };

  // --- 이벤트 로그 합성 ---
  const events: Array<{ timestamp: string; level: 'info' | 'warn' | 'error'; message: string }> = [];
  events.push({ timestamp: timeline.jobCreatedAt, level: 'info', message: `파이프라인 시작: "${job.keyword}" 분석` });

  if (progress) {
    for (const [key, val] of Object.entries(progress)) {
      const label = SOURCE_LABELS[key] ?? key;
      const count = (val.articles ?? 0) + (val.videos ?? 0) + (val.posts ?? 0) + (val.comments ?? 0);
      if (val.status === 'completed') {
        events.push({ timestamp: timeline.jobUpdatedAt, level: 'info', message: `${label} 수집 완료 (${count}건)` });
      } else if (val.status === 'failed') {
        events.push({ timestamp: timeline.jobUpdatedAt, level: 'error', message: `${label} 수집 실패: ${errorDetails?.[key] ?? '알 수 없는 오류'}` });
      } else if (val.status === 'running') {
        events.push({ timestamp: timeline.jobCreatedAt, level: 'info', message: `${label} 수집 중... (현재 ${count}건)` });
      }
    }
  }

  if (collectionDone) {
    const totalCount = Object.values(sourceDetails).reduce((sum, s) => sum + s.count, 0);
    events.push({
      timestamp: timeline.jobUpdatedAt,
      level: job.status === 'partial_failure' ? 'warn' : 'info',
      message: job.status === 'partial_failure' ? `수집 부분 완료 (총 ${totalCount}건, 일부 소스 실패)` : `수집 완료 (총 ${totalCount}건)`,
    });
  } else if (collectionFailed) {
    events.push({ timestamp: timeline.jobUpdatedAt, level: 'error', message: '수집 실패 — 파이프라인 중단' });
  }

  for (const mod of analysisModulesDetailed) {
    const label = MODULE_LABELS[mod.module] ?? mod.module;
    if (mod.status === 'completed' && mod.completedAt) {
      const tokenInfo = mod.usage ? ` (${(mod.usage.input + mod.usage.output).toLocaleString()} 토큰)` : '';
      events.push({ timestamp: mod.completedAt, level: 'info', message: `${label} 분석 완료${tokenInfo}` });
    } else if (mod.status === 'failed' && mod.completedAt) {
      events.push({ timestamp: mod.completedAt, level: 'error', message: `${label} 분석 실패: ${mod.errorMessage ?? '알 수 없는 오류'}` });
    } else if (mod.status === 'running' && mod.startedAt) {
      events.push({ timestamp: mod.startedAt, level: 'info', message: `${label} 분석 진행 중...` });
    }
  }

  if (reportDone && timeline.reportCompletedAt) {
    events.push({ timestamp: timeline.reportCompletedAt, level: 'info', message: '종합 리포트 생성 완료' });
  }

  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // --- 전체 진행률 (수집 중에도 진행률 반영) ---
  const sourceEntries = Object.values(sourceDetails);
  const totalSources = Math.max(sourceEntries.length, 1);

  // 수집 진행률: 완료 소스 + running 소스의 부분 진행률
  let collectionProgressValue = 0;
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
  const completedModulesCount = analysisRows.filter(r => r.status === 'completed').length;
  const totalExpectedModules = 12; // 전체 분석 모듈 수 (고정)
  const analysisProgressValue = collectionFailed ? 0
    : analysisRows.length > 0 ? (completedModulesCount / totalExpectedModules) * 50
    : 0;

  const reportProgress = reportDone ? 10 : 0;
  const overallProgress = Math.min(100, Math.round(collectionProgressValue + analysisProgressValue + reportProgress));
  const elapsedSeconds = Math.floor((Date.now() - new Date(job.createdAt).getTime()) / 1000);

  return {
    status: job.status,
    progress: job.progress,
    errorDetails: job.errorDetails,
    keyword: job.keyword,
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
  };
}
