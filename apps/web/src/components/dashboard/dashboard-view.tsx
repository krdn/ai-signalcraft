'use client';

import { useQuery } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

import { SentimentChart } from './sentiment-chart';
import { TrendChart } from './trend-chart';
import { WordCloud } from './word-cloud';
import { PlatformCompare } from './platform-compare';
import { RiskCards } from './risk-cards';
import { OpportunityCards } from './opportunity-cards';

interface DashboardViewProps {
  jobId: number | null;
}

// 모듈별 결과를 파싱하는 유틸
function parseModuleResult(results: Array<{ module: string; result: unknown }>, moduleName: string) {
  const found = results.find((r) => r.module === moduleName);
  return found?.result as Record<string, unknown> | undefined;
}

export function DashboardView({ jobId }: DashboardViewProps) {
  const {
    data: results,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['analysis', 'getResults', jobId],
    queryFn: () => trpcClient.analysis.getResults.query({ jobId: jobId! }),
    enabled: !!jobId,
  });

  // jobId 없음 -- 빈 상태
  if (!jobId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-lg font-semibold">분석 결과가 없습니다</p>
        <p className="text-sm mt-2">
          분석 실행 탭에서 새 분석을 시작하거나, 히스토리에서 이전 결과를 선택하세요.
        </p>
      </div>
    );
  }

  // 로딩 상태 -- Skeleton 카드
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="min-h-[280px]">
            <CardContent className="p-6">
              <Skeleton className="h-6 w-32 mb-4" />
              <Skeleton className="h-[200px] w-full rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // 에러 상태
  if (isError) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-muted-foreground">결과를 불러오는 중 오류가 발생했습니다.</p>
          <Button variant="outline" onClick={() => refetch()}>
            다시 시도
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 결과 파싱
  const moduleResults = (results ?? []) as Array<{ module: string; result: unknown }>;

  const sentimentFraming = parseModuleResult(moduleResults, 'sentiment-framing');
  const macroView = parseModuleResult(moduleResults, 'macro-view');
  const segmentation = parseModuleResult(moduleResults, 'segmentation');
  const riskMap = parseModuleResult(moduleResults, 'risk-map');
  const opportunity = parseModuleResult(moduleResults, 'opportunity');

  // 감성 비율 데이터
  const sentimentData = sentimentFraming?.sentimentRatio as {
    positive: number;
    negative: number;
    neutral: number;
  } | undefined;

  // 시계열 트렌드 데이터
  const trendData = sentimentFraming?.dailyMentionTrend as Array<{
    date: string;
    mentions: number;
    positive: number;
    negative: number;
    neutral: number;
  }> | undefined;

  // 키워드 데이터 (macro-view의 keyTopics)
  const keyTopics = macroView?.keyTopics as Array<{ topic: string; count: number }> | undefined;
  const wordCloudData = keyTopics?.map((t) => ({ text: t.topic, value: t.count })) ?? null;

  // 플랫폼 비교 데이터 (segmentation의 sentimentByPlatform)
  const platformData = segmentation?.sentimentByPlatform as Array<{
    platform: string;
    positive: number;
    negative: number;
    neutral: number;
  }> | undefined;

  // 리스크 데이터
  const risks = riskMap?.risks as Array<{
    title: string;
    description: string;
    impact: number;
    urgency: string;
    spreadPotential: string;
  }> | undefined;

  // 기회 데이터
  const opportunities = opportunity?.opportunities as Array<{
    title: string;
    description: string;
    impact: number;
    feasibility: string;
  }> | undefined;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <SentimentChart data={sentimentData ?? null} />
      <TrendChart data={trendData ?? null} />
      <WordCloud words={wordCloudData} />
      <PlatformCompare data={platformData ?? null} />
      <RiskCards risks={risks ?? null} />
      <OpportunityCards opportunities={opportunities ?? null} />
    </div>
  );
}
