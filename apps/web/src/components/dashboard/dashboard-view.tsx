'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { KpiCards } from './kpi-cards';
import { InsightSummary } from './insight-summary';
import { SentimentChart } from './sentiment-chart';
import { TrendChart } from './trend-chart';
import { WordCloud } from './word-cloud';
import { PlatformCompare } from './platform-compare';
import { RiskCards } from './risk-cards';
import { OpportunityCards } from './opportunity-cards';
import { CompareSelector } from './compare-selector';
import { CompareView } from './compare-view';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpcClient } from '@/lib/trpc';

interface DashboardViewProps {
  jobId: number | null;
}

// 모듈별 결과를 파싱하는 유틸
function parseModuleResult(
  results: Array<{ module: string; result: unknown }>,
  moduleName: string,
) {
  const found = results.find((r) => r.module === moduleName);
  return found?.result as Record<string, unknown> | undefined;
}

export function DashboardView({ jobId }: DashboardViewProps) {
  const [compareJobId, setCompareJobId] = useState<number | null>(null);

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
  const finalSummary = parseModuleResult(moduleResults, 'final-summary');

  // 감성 비율 데이터 — sentiment-framing.sentimentRatio (일치)
  const sentimentData = sentimentFraming?.sentimentRatio as
    | {
        positive: number;
        negative: number;
        neutral: number;
      }
    | undefined;

  // 시계열 트렌드 데이터 — macro-view.dailyMentionTrend (수정: sentiment-framing → macro-view)
  const rawTrend = macroView?.dailyMentionTrend as
    | Array<{
        date: string;
        count: number;
        sentimentRatio: { positive: number; negative: number; neutral: number };
      }>
    | undefined;
  // 이벤트 마커 데이터 — macro-view.inflectionPoints
  const inflectionPoints = macroView?.inflectionPoints as
    | Array<{
        date: string;
        description: string;
      }>
    | undefined;
  const trendEvents =
    inflectionPoints?.map((p) => ({
      date: p.date,
      label: p.description.length > 15 ? p.description.slice(0, 15) + '…' : p.description,
    })) ?? null;

  // TrendChart 형식으로 변환
  const trendData =
    rawTrend?.map((t) => ({
      date: t.date,
      mentions: t.count,
      positive: Math.round(t.count * (t.sentimentRatio?.positive ?? 0)),
      negative: Math.round(t.count * (t.sentimentRatio?.negative ?? 0)),
      neutral: Math.round(t.count * (t.sentimentRatio?.neutral ?? 0)),
    })) ?? null;

  // 키워드 데이터 — sentiment-framing.topKeywords (수정: macro-view.keyTopics → sentiment-framing.topKeywords)
  const topKeywords = sentimentFraming?.topKeywords as
    | Array<{
        keyword: string;
        count: number;
        sentiment: string;
      }>
    | undefined;
  const wordCloudData = topKeywords?.map((t) => ({ text: t.keyword, value: t.count })) ?? null;

  // 플랫폼 비교 데이터 — segmentation.platformSegments (수정: sentimentByPlatform → platformSegments)
  const platformSegments = segmentation?.platformSegments as
    | Array<{
        platform: string;
        sentiment: string;
        volume: number;
        keyTopics: string[];
        characteristics: string;
      }>
    | undefined;
  // sentiment enum을 수치로 변환
  const platformData =
    platformSegments?.map((seg) => ({
      platform: seg.platform,
      positive:
        seg.sentiment === 'positive'
          ? seg.volume
          : seg.sentiment === 'mixed'
            ? Math.round(seg.volume * 0.4)
            : 0,
      negative:
        seg.sentiment === 'negative'
          ? seg.volume
          : seg.sentiment === 'mixed'
            ? Math.round(seg.volume * 0.3)
            : 0,
      neutral: seg.sentiment === 'mixed' ? Math.round(seg.volume * 0.3) : 0,
    })) ?? null;

  // 리스크 데이터 — risk-map.topRisks (수정: risks → topRisks, 구조 변환)
  const topRisks = riskMap?.topRisks as
    | Array<{
        rank: number;
        title: string;
        description: string;
        impactLevel: string;
        spreadProbability: number;
        currentStatus: string;
        triggerConditions: string[];
      }>
    | undefined;
  const risks =
    topRisks?.map((r) => ({
      title: r.title,
      description: r.description,
      impact:
        r.impactLevel === 'critical'
          ? 90
          : r.impactLevel === 'high'
            ? 70
            : r.impactLevel === 'medium'
              ? 45
              : 20,
      urgency: r.impactLevel,
      spreadPotential: `${Math.round(r.spreadProbability * 100)}%`,
    })) ?? null;

  // 기회 데이터 — opportunity.positiveAssets (수정: opportunities → positiveAssets, 구조 변환)
  const positiveAssets = opportunity?.positiveAssets as
    | Array<{
        title: string;
        description: string;
        expandability: string;
        currentUtilization: string;
        recommendation: string;
      }>
    | undefined;
  const opportunities =
    positiveAssets?.map((a) => ({
      title: a.title,
      description: `${a.description}\n추천: ${a.recommendation}`,
      impact: a.expandability === 'high' ? 80 : a.expandability === 'medium' ? 50 : 25,
      feasibility: a.expandability,
    })) ?? null;

  // KPI 데이터
  const totalMentions = rawTrend?.reduce((sum, t) => sum + t.count, 0) ?? null;
  const topKeywordText = topKeywords?.[0]?.keyword ?? null;
  const overallDirection =
    (macroView?.overallDirection as 'positive' | 'negative' | 'mixed') ?? null;

  // 인사이트 요약 데이터 (final-summary 모듈)
  const insightOneLiner = (finalSummary?.oneLiner as string) ?? null;
  const insightCurrentState =
    (finalSummary?.currentState as {
      summary: string;
      sentiment: string;
      keyFactor: string;
    } | null) ?? null;
  const insightActions =
    (finalSummary?.criticalActions as Array<{
      priority: number;
      action: string;
      expectedImpact: string;
      timeline: string;
    }> | null) ?? null;

  return (
    <div className="space-y-6">
      {/* 비교 분석 셀렉터 */}
      <CompareSelector
        currentJobId={jobId}
        compareJobId={compareJobId}
        onSelect={setCompareJobId}
      />

      {/* 비교 모드일 때 CompareView 표시 */}
      {compareJobId && <CompareView baseJobId={jobId} compareJobId={compareJobId} />}

      {/* KPI 카드 — 핵심 지표 한눈에 */}
      <KpiCards
        totalMentions={totalMentions}
        sentimentRatio={sentimentData ?? null}
        topKeyword={topKeywordText}
        overallDirection={overallDirection}
      />

      {/* AI 인사이트 요약 */}
      <InsightSummary
        oneLiner={insightOneLiner}
        currentState={insightCurrentState}
        criticalActions={insightActions}
      />

      {/* 차트 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <SentimentChart data={sentimentData ?? null} />
        <TrendChart data={trendData} events={trendEvents} />
        <WordCloud words={wordCloudData} />
        <PlatformCompare data={platformData} />
        <RiskCards risks={risks} />
        <OpportunityCards opportunities={opportunities} />
      </div>
    </div>
  );
}
