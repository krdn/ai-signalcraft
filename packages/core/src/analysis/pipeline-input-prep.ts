// 분석 파이프라인 — 입력 로드 직후 progress/persist 기록
//
// pipeline-orchestrator.ts의 메인 흐름에서 progress 페이로드 빌드 로직을 분리.
// 모든 헬퍼는 비차단 (실패 시 로그만, 분석 차단 아님).
import { logError } from '../utils/logger';
import { updateJobProgress, appendJobEvent } from '../pipeline/persist';
import { persistFromCollectorPayload } from '../pipeline/persist-from-collector';
import type { AnalysisInput } from './types';
import type { CollectorAnalysisResult } from './data-loader';

// loadAnalysisInput / loadAnalysisInputViaCollector가 반환하는 samplingStats의 형태를
// 캡처하기 위한 최소 타입 (run 시점의 실제 값은 더 풍부하나, persist만 한다).
type SamplingStats = {
  binCount: number;
  binIntervalMs: number;
  articles: {
    totalInput: number;
    totalSampled: number;
    binsUsed: number;
    nullPoolSize: number;
    nullPoolSampled: number;
    perBin: Array<{ start: Date; end: Date; inputCount: number; sampledCount: number }>;
  };
  comments: {
    totalInput: number;
    totalSampled: number;
    binsUsed: number;
    nullPoolSize: number;
    nullPoolSampled: number;
    perBin: Array<{ start: Date; end: Date; inputCount: number; sampledCount: number }>;
  };
  videos: {
    totalInput: number;
    totalSampled: number;
    binsUsed: number;
    nullPoolSize: number;
    nullPoolSampled: number;
  };
};

/**
 * 구독 단축 경로에서 collector fullset을 web DB에 영속화.
 *
 * RAG SQL과 UI 카운트가 일반 경로와 동일한 의미를 갖도록 article_jobs/comment_jobs/video_jobs
 * 조인 테이블을 채운다. (job 271 사례 — linkage 0건 결함 수정)
 *
 * 실패해도 분석 자체는 RAG sample 입력으로 계속 진행 (linkage 누락은 가시성 손실이지 분석 차단 아님).
 */
export async function persistCollectorFullset(
  jobId: number,
  loadResult: { fullset?: CollectorAnalysisResult['fullset'] },
): Promise<void> {
  if (!('fullset' in loadResult) || !loadResult.fullset) return;

  await updateJobProgress(jobId, {
    persist: { status: 'running', source: 'collector' },
  }).catch((err) => logError('pipeline-orchestrator', err));

  try {
    const persistResult = await persistFromCollectorPayload(jobId, loadResult.fullset);
    await updateJobProgress(jobId, {
      persist: {
        status: 'completed',
        source: 'collector',
        articles: persistResult.articles,
        videos: persistResult.videos,
        comments: persistResult.comments,
      },
    }).catch((err) => logError('pipeline-orchestrator', err));
  } catch (err) {
    await updateJobProgress(jobId, {
      persist: {
        status: 'failed',
        source: 'collector',
        error: err instanceof Error ? err.message : String(err),
      },
    }).catch((err) => logError('pipeline-orchestrator', err));
    try {
      await appendJobEvent(
        jobId,
        'warn',
        `persistFromCollectorPayload 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    } catch (err) {
      logError('pipeline-orchestrator', err);
    }
  }
}

/**
 * P3: 시계열 샘플링 통계를 progress에 기록.
 *
 * 폴백 동작·시간 편향 디버깅용. items 배열은 빠지므로 페이로드는 작음.
 */
export async function recordSamplingStats(
  jobId: number,
  samplingStats: SamplingStats,
): Promise<void> {
  await updateJobProgress(jobId, {
    sampling: {
      status: 'completed',
      binCount: samplingStats.binCount,
      binIntervalMs: samplingStats.binIntervalMs,
      articles: {
        totalInput: samplingStats.articles.totalInput,
        totalSampled: samplingStats.articles.totalSampled,
        binsUsed: samplingStats.articles.binsUsed,
        nullPoolSize: samplingStats.articles.nullPoolSize,
        nullPoolSampled: samplingStats.articles.nullPoolSampled,
        perBin: samplingStats.articles.perBin.map((b) => ({
          start: b.start.toISOString(),
          end: b.end.toISOString(),
          inputCount: b.inputCount,
          sampledCount: b.sampledCount,
        })),
      },
      comments: {
        totalInput: samplingStats.comments.totalInput,
        totalSampled: samplingStats.comments.totalSampled,
        binsUsed: samplingStats.comments.binsUsed,
        nullPoolSize: samplingStats.comments.nullPoolSize,
        nullPoolSampled: samplingStats.comments.nullPoolSampled,
        perBin: samplingStats.comments.perBin.map((b) => ({
          start: b.start.toISOString(),
          end: b.end.toISOString(),
          inputCount: b.inputCount,
          sampledCount: b.sampledCount,
        })),
      },
      videos: {
        totalInput: samplingStats.videos.totalInput,
        totalSampled: samplingStats.videos.totalSampled,
        binsUsed: samplingStats.videos.binsUsed,
        nullPoolSize: samplingStats.videos.nullPoolSize,
        nullPoolSampled: samplingStats.videos.nullPoolSampled,
      },
    },
  }).catch((err) => logError('pipeline-orchestrator', err));
}

/**
 * 구독 단축 경로에서 input의 소스별 카운트를 progress에 기록.
 *
 * 수집/정규화 단계가 없으므로 UI에서 건수를 표시하기 위한 경로.
 */
export async function recordSubscriptionSourceStats(
  jobId: number,
  input: AnalysisInput,
): Promise<void> {
  const subStats: Record<
    string,
    { status: string; articles: number; comments: number; videos: number }
  > = {};
  const sourceGroups = new Map<string, { articles: number; comments: number; videos: number }>();
  for (const a of input.articles) {
    const src = a.source || 'unknown';
    const g = sourceGroups.get(src) || { articles: 0, comments: 0, videos: 0 };
    g.articles++;
    sourceGroups.set(src, g);
  }
  for (const c of input.comments) {
    const src = c.source || 'unknown';
    const g = sourceGroups.get(src) || { articles: 0, comments: 0, videos: 0 };
    g.comments++;
    sourceGroups.set(src, g);
  }
  for (const _v of input.videos) {
    const src = 'youtube';
    const g = sourceGroups.get(src) || { articles: 0, comments: 0, videos: 0 };
    g.videos++;
    sourceGroups.set(src, g);
  }
  for (const [src, g] of sourceGroups) {
    subStats[src] = { status: 'completed', ...g };
  }
  await updateJobProgress(jobId, subStats).catch((err) => logError('pipeline-orchestrator', err));
}
