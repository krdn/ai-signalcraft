'use client';

import { Database, TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import { formatRelative, SOURCE_LABEL_MAP } from './subscription-utils';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type {
  SubscriptionRecord,
  RunRecord,
  StatsResult,
} from '@/server/trpc/routers/subscriptions';

interface SubscriptionKpiCardsProps {
  subscriptions: SubscriptionRecord[];
  runs: RunRecord[];
  itemStats?: StatsResult | null;
}

export function SubscriptionKpiCards({
  subscriptions,
  runs,
  itemStats,
}: SubscriptionKpiCardsProps) {
  const activeCount = subscriptions.filter((s) => s.status === 'active').length;
  const pausedCount = subscriptions.filter((s) => s.status === 'paused').length;
  const errorCount = subscriptions.filter((s) => s.status === 'error').length;

  const now = Date.now();
  const h24Ago = now - 24 * 3600 * 1000;
  const h48Ago = now - 48 * 3600 * 1000;
  const runs24h = runs.filter((r) => new Date(r.time).getTime() >= h24Ago);
  const runs48hPrev = runs.filter((r) => {
    const t = new Date(r.time).getTime();
    return t >= h48Ago && t < h24Ago;
  });
  const collected24h = runs24h.reduce((sum, r) => sum + (r.itemsCollected ?? 0), 0);
  const collectedPrev = runs48hPrev.reduce((sum, r) => sum + (r.itemsCollected ?? 0), 0);
  const changePct =
    collectedPrev > 0 ? Math.round(((collected24h - collectedPrev) / collectedPrev) * 100) : null;

  const completedRuns24h = runs24h.filter((r) => r.status === 'completed').length;
  const successRate = runs24h.length > 0 ? (completedRuns24h / runs24h.length) * 100 : 100;

  const nextRun = subscriptions
    .filter((s) => s.status === 'active' && s.nextRunAt)
    .sort(
      (a, b) =>
        new Date(a.nextRunAt as string).getTime() - new Date(b.nextRunAt as string).getTime(),
    )[0];

  const articleCount = itemStats?.byItemType?.find((t) => t.itemType === 'article')?.count ?? 0;
  const videoCount = itemStats?.byItemType?.find((t) => t.itemType === 'video')?.count ?? 0;
  const commentCount = itemStats?.byItemType?.find((t) => t.itemType === 'comment')?.count ?? 0;
  const totalItems = itemStats?.totalItems ?? 0;

  const collectedSubtitle = itemStats
    ? `기사 ${articleCount.toLocaleString()} · 영상 ${videoCount.toLocaleString()} · 댓글 ${commentCount.toLocaleString()}`
    : changePct !== null
      ? `전일 대비 ${changePct >= 0 ? '+' : ''}${changePct}%`
      : '비교 데이터 없음';

  const collectedValue = itemStats
    ? totalItems.toLocaleString() + '건'
    : collected24h.toLocaleString() + '건';

  const collectedTitle = itemStats ? '누적 수집량' : '24시간 수집량';

  const cards = [
    {
      title: '총 구독',
      value: `${activeCount}개 활성`,
      subtitle: `정지 ${pausedCount} / 오류 ${errorCount}`,
      icon: Database,
      accent: 'border-t-blue-500',
    },
    {
      title: collectedTitle,
      value: collectedValue,
      subtitle: collectedSubtitle,
      icon: TrendingUp,
      accent: 'border-t-emerald-500',
    },
    {
      title: '실행 성공률',
      value: `${successRate.toFixed(1)}%`,
      subtitle: `최근 24시간 (${completedRuns24h}/${runs24h.length})`,
      icon: CheckCircle2,
      accent: 'border-t-violet-500',
    },
    {
      title: '다음 수집',
      value: nextRun ? formatRelative(nextRun.nextRunAt) : '예정 없음',
      subtitle: nextRun
        ? `${nextRun.keyword} (${(nextRun.sources as string[]).map((s) => SOURCE_LABEL_MAP[s] ?? s).join(', ')})`
        : '',
      icon: Clock,
      accent: 'border-t-amber-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card
          key={card.title}
          className={cn(
            'border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all border-t-2',
            card.accent,
          )}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <card.icon className="h-4 w-4" />
              <span className="text-xs font-medium">{card.title}</span>
            </div>
            <p className="text-xl font-bold truncate">{card.value}</p>
            {card.subtitle ? (
              <p className="text-xs text-muted-foreground mt-1 truncate">{card.subtitle}</p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
