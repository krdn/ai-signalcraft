'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { trpcClient } from '@/lib/trpc';
import { SubscriptionHeader } from '@/components/subscriptions/subscription-header';
import { SubscriptionKpiCards } from '@/components/subscriptions/subscription-kpi-cards';
import { SubscriptionTrendChart } from '@/components/subscriptions/subscription-trend-chart';
import { SourceStatusCard } from '@/components/subscriptions/source-status-card';
import { RunHistoryTable } from '@/components/subscriptions/run-history-table';
import { SubscriptionForm } from '@/components/subscriptions/subscription-form';
import { SOURCE_LABEL_MAP, formatRelative } from '@/components/subscriptions/subscription-utils';

export default function SubscriptionDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const [editOpen, setEditOpen] = useState(false);

  const subQuery = useQuery({
    queryKey: ['subscriptions', id],
    queryFn: () => trpcClient.subscriptions.get.query({ id }),
    enabled: !isNaN(id),
    refetchInterval: 30_000,
  });

  const runsQuery = useQuery({
    queryKey: ['subscription-runs', { subscriptionId: id, sinceHours: 720 }],
    queryFn: () =>
      trpcClient.subscriptions.runs.query({
        subscriptionId: id,
        sinceHours: 720,
        limit: 500,
      }),
    enabled: !isNaN(id),
    refetchInterval: 30_000,
  });

  const sub = subQuery.data;
  const runs = runsQuery.data ?? [];

  const itemStatsQuery = useQuery({
    queryKey: ['item-stats', { subscriptionId: id }],
    queryFn: () =>
      trpcClient.subscriptions.itemStats.query({
        subscriptionId: id,
        dateRange: {
          start: new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
      }),
    enabled: !isNaN(id) && !!sub,
    refetchInterval: 60_000,
  });

  const itemStats = itemStatsQuery.data;

  if (subQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        불러오는 중...
      </div>
    );
  }

  if (subQuery.isError || !sub) {
    return (
      <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
        {subQuery.error instanceof Error ? subQuery.error.message : '구독을 찾을 수 없습니다'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SubscriptionHeader subscription={sub} onEdit={() => setEditOpen(true)} />

      <SubscriptionKpiCards subscriptions={[sub]} runs={runs} itemStats={itemStats} />

      <Tabs defaultValue="collection" className="space-y-4">
        <TabsList>
          <TabsTrigger value="collection">수집 현황</TabsTrigger>
          <TabsTrigger value="analysis">분석 히스토리</TabsTrigger>
          <TabsTrigger value="settings">설정</TabsTrigger>
        </TabsList>

        <TabsContent value="collection" className="space-y-4">
          <SubscriptionTrendChart runs={runs} title={`${sub.keyword} 수집 트렌드`} days={30} />

          <div>
            <h3 className="text-sm font-medium mb-2">소스별 상태</h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {(sub.sources as string[]).map((source) => (
                <SourceStatusCard
                  key={source}
                  source={source}
                  runs={runs}
                  itemBreakdown={itemStats?.bySourceAndType?.filter((s) => s.source === source)}
                />
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">실행 히스토리</h3>
            <RunHistoryTable runs={runs} limit={100} />
          </div>
        </TabsContent>

        <TabsContent value="analysis">
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              이 키워드의 분석 히스토리는 대시보드에서 확인할 수 있습니다.
              <br />
              <a
                href={`/dashboard?keyword=${encodeURIComponent(sub.keyword)}`}
                className="text-blue-600 hover:underline mt-1 inline-block"
              >
                대시보드에서 &quot;{sub.keyword}&quot; 분석 보기 →
              </a>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardContent className="p-6 space-y-3">
              <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
                <dt className="text-muted-foreground">키워드</dt>
                <dd className="font-medium">{sub.keyword}</dd>
                <dt className="text-muted-foreground">소스</dt>
                <dd>{(sub.sources as string[]).map((s) => SOURCE_LABEL_MAP[s] ?? s).join(', ')}</dd>
                <dt className="text-muted-foreground">수집 주기</dt>
                <dd>{sub.intervalHours}시간</dd>
                <dt className="text-muted-foreground">실행당 최대 수집</dt>
                <dd>{sub.limits.maxPerRun}건</dd>
                <dt className="text-muted-foreground">댓글/항목</dt>
                <dd>{sub.limits.commentsPerItem ?? '설정 안 함'}</dd>
                <dt className="text-muted-foreground">자막 수집</dt>
                <dd>{sub.options?.collectTranscript ? 'ON' : 'OFF'}</dd>
                <dt className="text-muted-foreground">생성일</dt>
                <dd>{formatRelative(sub.createdAt)}</dd>
                <dt className="text-muted-foreground">마지막 실행</dt>
                <dd>{formatRelative(sub.lastRunAt)}</dd>
                <dt className="text-muted-foreground">다음 예정</dt>
                <dd>{formatRelative(sub.nextRunAt)}</dd>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>구독 수정</DialogTitle>
            <DialogDescription>변경사항은 다음 수집부터 적용됩니다.</DialogDescription>
          </DialogHeader>
          <SubscriptionForm
            onCreated={() => {
              setEditOpen(false);
              subQuery.refetch();
            }}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
