'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Brain } from 'lucide-react';
import { ApprovalRatingCard } from './approval-rating-card';
import { FrameWarChart } from './frame-war-chart';
import { CrisisScenarios } from './crisis-scenarios';
import { WinSimulationCard } from './win-simulation-card';
import { AdvancedHelp } from './advanced-help';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpcClient } from '@/lib/trpc';

interface AdvancedViewProps {
  jobId: number | null;
}

// ADVN 모듈 이름 목록
const ADVN_MODULES = ['approval-rating', 'frame-war', 'crisis-scenario', 'win-simulation'];

// 모듈별 결과를 파싱하는 유틸
function parseModuleResult(
  results: Array<{ module: string; result: unknown }>,
  moduleName: string,
) {
  const found = results.find((r) => r.module === moduleName);
  return found?.result as Record<string, unknown> | undefined;
}

export function AdvancedView({ jobId }: AdvancedViewProps) {
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
        <Brain className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-semibold">분석 결과를 선택하세요</p>
        <p className="text-sm mt-2">
          분석 실행 탭에서 새 분석을 시작하거나, 히스토리에서 이전 결과를 선택하세요.
        </p>
      </div>
    );
  }

  // 로딩 상태 -- Skeleton 카드
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="min-h-[320px]">
            <CardContent className="p-6">
              <Skeleton className="h-6 w-40 mb-4" />
              <Skeleton className="h-[260px] w-full rounded" />
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

  // ADVN 결과가 있는지 확인
  const hasAdvnResults = moduleResults.some((r) => ADVN_MODULES.includes(r.module));

  if (!hasAdvnResults) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Brain className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-semibold">이 분석에는 고급 분석 결과가 없습니다</p>
        <p className="text-sm mt-2">
          고급 분석은 최신 분석에서만 실행됩니다. 새 분석을 실행해 주세요.
        </p>
      </div>
    );
  }

  const approvalRating = parseModuleResult(moduleResults, 'approval-rating');
  const frameWar = parseModuleResult(moduleResults, 'frame-war');
  const crisisScenario = parseModuleResult(moduleResults, 'crisis-scenario');
  const winSimulation = parseModuleResult(moduleResults, 'win-simulation');

  return (
    <div className="space-y-4">
      {/* 상단 가이드 버튼 */}
      <div className="flex justify-end">
        <AdvancedHelp />
      </div>

      {/* 카드 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ApprovalRatingCard data={approvalRating ?? null} />
        <FrameWarChart data={frameWar ?? null} />
        <CrisisScenarios data={crisisScenario ?? null} />
        <WinSimulationCard data={winSimulation ?? null} />
      </div>
    </div>
  );
}
