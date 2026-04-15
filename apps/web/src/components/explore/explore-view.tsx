'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Telescope, AlertCircle } from 'lucide-react';
import { ExploreFilters, DEFAULT_FILTERS, type ExploreFilterState } from './explore-filters';
import { StreamChart } from './stream-chart';
import { CalendarHeatmap } from './calendar-heatmap';
import { ScatterEngagement } from './scatter-engagement';
import { SourceSentimentMatrix } from './source-sentiment-matrix';
import { ScoreHistogram } from './score-histogram';
import { KeywordTreemap } from './keyword-treemap';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ExploreViewProps {
  jobId: number | null;
  onNavigateToCollected?: (source?: string, articleId?: number) => void;
  initialSourceFilter?: string | null;
}

export function ExploreView({
  jobId,
  onNavigateToCollected,
  initialSourceFilter,
}: ExploreViewProps) {
  const [filters, setFilters] = useState<ExploreFilterState>(DEFAULT_FILTERS);

  // initialSourceFilter가 있으면 마운트 시 소스 필터 적용
  useEffect(() => {
    if (initialSourceFilter) {
      setFilters((prev) => ({
        ...prev,
        sources: prev.sources.includes(initialSourceFilter)
          ? prev.sources
          : [...prev.sources, initialSourceFilter],
      }));
    }
  }, [initialSourceFilter]);

  // 각 차트의 useQuery queryKey에 필터가 포함되어 자동 재요청
  const baseKey = ['explore', jobId, filters] as const;

  const filterParams = {
    jobId: jobId!,
    sources: filters.sources.length > 0 ? filters.sources : undefined,
    sentiments: filters.sentiments.length > 0 ? filters.sentiments : undefined,
    minScore: filters.minScore > 0 ? filters.minScore : undefined,
    dateScope: filters.dateScope,
  } as const;

  const timeSeries = useQuery({
    queryKey: [...baseKey, 'timeSeries'],
    queryFn: () =>
      trpcClient.explore.getSentimentTimeSeries.query({
        ...filterParams,
        itemType: filters.itemType,
      }),
    enabled: jobId != null,
  });

  const bySource = useQuery({
    queryKey: [...baseKey, 'bySource'],
    queryFn: () =>
      trpcClient.explore.getSentimentBySource.query({
        ...filterParams,
        itemType: filters.itemType,
      }),
    enabled: jobId != null,
  });

  const scoreDist = useQuery({
    queryKey: [...baseKey, 'scoreDist'],
    queryFn: () =>
      trpcClient.explore.getScoreDistribution.query({
        ...filterParams,
        itemType: filters.itemType,
      }),
    enabled: jobId != null,
  });

  const scatter = useQuery({
    queryKey: [...baseKey, 'scatter'],
    queryFn: () =>
      trpcClient.explore.getEngagementScatter.query({
        ...filterParams,
        itemType: 'comments',
      }),
    enabled: jobId != null,
  });

  const keywords = useQuery({
    queryKey: ['explore', jobId, 'keywords'],
    queryFn: () => trpcClient.explore.getKeywordSentiment.query({ jobId: jobId! }),
    enabled: jobId != null,
    staleTime: Infinity, // 모듈 결과는 분석 완료 후 변경 없음
  });

  const bySourceSplit = useQuery({
    queryKey: ['explore', jobId, filters.dateScope, 'bySourceSplit'],
    queryFn: () =>
      trpcClient.explore.getSentimentBySourceSplit.query({
        jobId: jobId!,
        dateScope: filters.dateScope,
      }),
    enabled: jobId != null,
  });

  if (!jobId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Telescope className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-semibold">탐색할 데이터가 없습니다</p>
        <p className="text-sm mt-2">
          분석 실행 탭에서 새 분석을 시작하거나, 히스토리에서 이전 결과를 선택하세요.
        </p>
      </div>
    );
  }

  const anyError =
    timeSeries.isError ||
    bySource.isError ||
    scoreDist.isError ||
    scatter.isError ||
    keywords.isError ||
    bySourceSplit.isError;

  if (anyError) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-muted-foreground">탐색 데이터를 불러올 수 없습니다.</p>
          <Button
            variant="outline"
            onClick={() => {
              timeSeries.refetch();
              bySource.refetch();
              scoreDist.refetch();
              scatter.refetch();
              keywords.refetch();
              bySourceSplit.refetch();
            }}
          >
            다시 시도
          </Button>
        </CardContent>
      </Card>
    );
  }

  const handleSelectSource = (source: string) => {
    setFilters((prev) => ({
      ...prev,
      sources: prev.sources.includes(source) ? prev.sources : [...prev.sources, source],
    }));
  };

  const handleDrillDownToCollected = (source: string) => {
    onNavigateToCollected?.(source);
  };

  return (
    <div className="space-y-4">
      <ExploreFilters value={filters} onChange={setFilters} />
      {onNavigateToCollected && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onNavigateToCollected()}>
            수집 데이터 보기 →
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StreamChart data={timeSeries.data} isLoading={timeSeries.isLoading} />
        <CalendarHeatmap data={timeSeries.data} isLoading={timeSeries.isLoading} />
        <ScatterEngagement
          data={scatter.data}
          isLoading={scatter.isLoading}
          onNavigateToArticle={
            onNavigateToCollected
              ? (articleId) => onNavigateToCollected(undefined, articleId)
              : undefined
          }
        />
        <SourceSentimentMatrix
          data={bySource.data}
          splitData={bySourceSplit.data}
          isLoading={bySource.isLoading || bySourceSplit.isLoading}
          onSelectSource={handleSelectSource}
          onDrillDownToCollected={onNavigateToCollected ? handleDrillDownToCollected : undefined}
        />
        <ScoreHistogram data={scoreDist.data} isLoading={scoreDist.isLoading} />
        <KeywordTreemap data={keywords.data} isLoading={keywords.isLoading} />
      </div>
    </div>
  );
}
