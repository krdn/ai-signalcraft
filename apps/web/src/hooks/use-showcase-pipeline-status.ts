'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc';
import type {
  PipelineStatusData,
  SourceDetail,
  AnalysisModuleDetailed,
} from '@/components/analysis/pipeline-monitor/types';

/**
 * showcase.getDetail 응답을 PipelineStatusData 타입으로 변환하는 어댑터 훅.
 * PipelineMonitor(readOnly)에 staticData로 전달할 수 있는 형태를 반환한다.
 */
export function useShowcasePipelineStatus(jobId: number) {
  const { data, isLoading } = useQuery({
    queryKey: ['showcase', 'getDetail', jobId],
    queryFn: () => trpcClient.showcase.getDetail.query({ jobId }),
    staleTime: Infinity,
    enabled: !isNaN(jobId),
  });

  const pipelineData = useMemo((): PipelineStatusData | null => {
    if (!data) return null;

    // sourceDetails: Record<string, SourceDetail>
    const sourceDetails: Record<string, SourceDetail> = {};
    for (const src of data.sources) {
      sourceDetails[src.key] = {
        status: 'completed',
        count: src.articles + src.comments,
        label: src.label,
        articles: src.articles,
        comments: src.comments,
        videos: 0,
        posts: 0,
      };
    }

    // pipelineStages: Record<string, { status: string }>
    const pipelineStages: Record<string, { status: string }> = {};
    for (const stage of data.pipelineStages) {
      pipelineStages[stage.key] = { status: stage.status };
    }

    // analysisModulesDetailed
    const analysisModulesDetailed: AnalysisModuleDetailed[] = data.analysisModules.map((mod) => ({
      module: mod.module,
      label: mod.label,
      status: 'completed' as const,
      stage: mod.stage,
      usage:
        mod.totalTokens > 0
          ? { input: 0, output: mod.totalTokens, provider: mod.provider, model: mod.model }
          : null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      durationSeconds: mod.durationSeconds,
    }));

    const totalTokens = data.stats.totalTokens;
    const EPOCH = new Date(0).toISOString(); // 고정 더미 타임스탬프

    return {
      status: 'completed',
      keyword: data.keyword,
      domain: data.domain,
      keywordType: null,
      progress: null,
      errorDetails: null,
      pipelineStages,
      analysisModuleCount: {
        total: data.stats.modulesTotal,
        completed: data.stats.modulesCompleted,
      },
      hasReport: true,
      sourceDetails,
      analysisModules: data.analysisModules.map((m) => ({
        module: m.module,
        status: 'completed' as const,
        label: m.label,
      })),
      elapsedSeconds: data.stats.durationSeconds,
      costLimitUsd: null,
      skippedModules: [],
      overallProgress: 100,
      tokenUsage: {
        total: { input: 0, output: totalTokens },
        byModule: [],
        estimatedCostUsd: 0,
      },
      timeline: {
        jobCreatedAt: EPOCH,
        jobUpdatedAt: EPOCH,
        analysisStartedAt: null,
        analysisCompletedAt: null,
        reportCompletedAt: null,
      },
      analysisModulesDetailed,
      events: [],
      itemAnalysis: null,
    };
  }, [data]);

  return { data: pipelineData, isLoading };
}
