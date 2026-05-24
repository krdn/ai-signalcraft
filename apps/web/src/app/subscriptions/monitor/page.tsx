'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, MoreVertical, HelpCircle, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { trpcClient } from '@/lib/trpc';
import { LiveRunFeed } from '@/components/subscriptions/live-run-feed';
import { UpcomingRuns } from '@/components/subscriptions/upcoming-runs';
import { RecentRunsLog } from '@/components/subscriptions/recent-runs-log';
import { SourceRunStats } from '@/components/subscriptions/source-run-stats';
import { CopyableClaudeRef } from '@/components/subscriptions/copyable-claude-ref';
import { StalledRunsBanner } from '@/components/subscriptions/stalled-runs-banner';
import { QueueStatsBar } from '@/components/subscriptions/queue-stats-bar';
import { SourcePauseControls } from '@/components/subscriptions/source-pause-controls';
import { CancelAllDialog } from '@/components/subscriptions/cancel-all-dialog';
import type { SentimentBreakdownEntry } from '@/server/trpc/routers/subscriptions';

function buildSentimentMap(
  data?: SentimentBreakdownEntry[],
): Record<string, { positive: number; negative: number; neutral: number }> {
  if (!data) return {};
  const map: Record<string, { positive: number; negative: number; neutral: number }> = {};
  for (const entry of data) {
    if (!entry.fetchedFromRun || !entry.sentiment) continue;
    if (!map[entry.fetchedFromRun]) {
      map[entry.fetchedFromRun] = { positive: 0, negative: 0, neutral: 0 };
    }
    const key = entry.sentiment as keyof (typeof map)[string];
    if (key in map[entry.fetchedFromRun]) {
      map[entry.fetchedFromRun][key] += entry.count;
    }
  }
  return map;
}

export default function MonitorPage() {
  const [cancelAllOpen, setCancelAllOpen] = useState(false);

  const subsQuery = useQuery({
    queryKey: ['subscriptions', 'all'],
    queryFn: () => trpcClient.subscriptions.list.query(),
    refetchInterval: 30_000,
  });

  const runsQuery = useQuery({
    queryKey: ['subscription-runs-monitor', { sinceHours: 24 }],
    queryFn: () => trpcClient.subscriptions.runs.query({ sinceHours: 24, limit: 500 }),
    refetchInterval: 5_000,
  });

  const subscriptions = subsQuery.data ?? [];
  const runs = runsQuery.data ?? [];

  const subscriptionMap = new Map(subscriptions.map((s) => [s.id, s.keyword]));

  const runIds = [...new Set(runs.map((r) => r.runId))];
  const breakdownQuery = useQuery({
    queryKey: ['run-item-breakdown-monitor', { runIds }],
    queryFn: () => trpcClient.subscriptions.runItemBreakdown.query({ runIds }),
    enabled: runIds.length > 0,
    refetchInterval: 15_000,
  });
  const breakdown = breakdownQuery.data;

  // 완료된 run들의 감정 집계
  const completedRunIds = [
    ...new Set(runs.filter((r) => r.status === 'completed').map((r) => r.runId)),
  ];
  const sentimentQuery = useQuery({
    queryKey: ['run-sentiment-breakdown-monitor', { runIds: completedRunIds }],
    queryFn: () =>
      trpcClient.subscriptions.runSentimentBreakdown.query({ runIds: completedRunIds }),
    enabled: completedRunIds.length > 0,
    refetchInterval: 15_000,
  });
  const sentimentMap = buildSentimentMap(sentimentQuery.data);

  const running = runs.filter((r) => r.status === 'running').length;
  const now = Date.now();
  const h1Ago = now - 3600 * 1000;
  const runs1h = runs.filter((r) => new Date(r.time).getTime() >= h1Ago);
  const completed1h = runs1h.filter((r) => r.status === 'completed').length;
  const failed1h = runs1h.filter((r) => r.status === 'failed' || r.status === 'blocked').length;

  const isHealthy = failed1h === 0;

  if (subsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-semibold">수집 모니터링</h1>
          <CopyableClaudeRef kind="monitor" size="sm" />
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent">
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={() => setCancelAllOpen(true)}
                >
                  전체 긴급 정지
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">실시간 수집 작업 상태를 확인합니다.</p>
        <Collapsible className="mt-3">
          <CollapsibleTrigger className="group inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer">
            <HelpCircle className="h-3.5 w-3.5" />
            화면 안내
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 rounded-lg border bg-card p-4 text-sm space-y-3">
              <div>
                <p className="font-semibold text-foreground mb-1.5">모니터링 화면 구성</p>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li>
                    <span className="text-foreground font-medium">실시간 피드</span> — 진행 중인
                    수집 run(작업 단위)을 5초마다 갱신합니다. run은 구독 1건의 소스 1개당 1개
                    생성됩니다.
                  </li>
                  <li>
                    <span className="text-foreground font-medium">예정 run</span> — 다음 실행이
                    예정된 구독 목록입니다. 수동 트리거가 필요하면 구독 상세 페이지에서 실행하세요.
                  </li>
                  <li>
                    <span className="text-foreground font-medium">최근 실행 로그</span> — 24시간 내
                    완료·실패 기록. 실패 run의 오류 코드를 복사해 AI에게 진단을 요청할 수 있습니다.
                  </li>
                  <li>
                    <span className="text-foreground font-medium">소스별 통계</span> — 소스(네이버
                    뉴스, 유튜브 등)별 성공/실패율과 평균 소요 시간을 확인합니다.
                  </li>
                  <li>
                    <span className="text-foreground font-medium">소스 일시 정지</span> — 특정
                    소스에 오류가 반복되면 해당 소스만 정지해 다른 수집에 영향을 주지 않을 수
                    있습니다.
                  </li>
                </ul>
              </div>
              <Separator />
              <div>
                <p className="font-semibold text-foreground mb-1.5">문제 상황별 대응</p>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li>
                    <span className="text-foreground">run이 장시간 running 상태</span> — 황색
                    "stalled" 배너가 뜨면 해당 run 행에서 [중지] 버튼을 눌러 정리하세요.
                  </li>
                  <li>
                    <span className="text-foreground">특정 소스 연속 실패</span> — 소스 일시 정지
                    패널에서 해당 소스를 비활성화한 뒤 원인을 파악하세요.
                  </li>
                  <li>
                    <span className="text-foreground">전체 수집 중단 필요</span> — 우측 상단 ⋮
                    메뉴의 <span className="text-red-600 font-medium">전체 긴급 정지</span>를
                    사용하세요. 모든 진행 중 작업이 즉시 취소됩니다.
                  </li>
                </ul>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <StalledRunsBanner />

      {/* 실시간 상태 헤더 */}
      <div className="flex items-center gap-4 rounded-lg border px-4 py-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${isHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`}
          />
          <span className="text-sm font-medium">{isHealthy ? '시스템 정상' : '경고 있음'}</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            실행 중{' '}
            <Badge variant={running > 0 ? 'default' : 'outline'} className="text-xs ml-0.5">
              {running}
            </Badge>
          </span>
          <span>
            완료(1h){' '}
            <Badge variant="outline" className="text-xs ml-0.5">
              {completed1h}
            </Badge>
          </span>
          <span>
            실패(1h){' '}
            <Badge variant={failed1h > 0 ? 'destructive' : 'outline'} className="text-xs ml-0.5">
              {failed1h}
            </Badge>
          </span>
        </div>
        <QueueStatsBar />
        {running > 0 && (
          <span className="relative flex h-2 w-2 ml-auto">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LiveRunFeed runs={runs} subscriptionMap={subscriptionMap} />
        <UpcomingRuns subscriptions={subscriptions} />
      </div>

      <RecentRunsLog
        runs={runs}
        subscriptionMap={subscriptionMap}
        breakdown={breakdown}
        sentimentMap={sentimentMap}
      />

      <SourceRunStats runs={runs} />

      <SourcePauseControls />

      <CancelAllDialog open={cancelAllOpen} onOpenChange={setCancelAllOpen} />
    </div>
  );
}
