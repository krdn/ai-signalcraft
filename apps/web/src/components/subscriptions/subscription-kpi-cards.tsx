'use client';

import { Database, TrendingUp, TrendingDown, Minus, CheckCircle2, Clock } from 'lucide-react';
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

type ChangeTone = 'up' | 'down' | 'flat';

/**
 * 변동률(%) → 부호별 시각 단서.
 *
 * SUBS-009: muted 텍스트만으로는 음수/양수 구분 불가 → 색·아이콘·부호 동반.
 * 색만으로는 WCAG 위반이므로 아이콘과 부호(+/-) 모두 사용.
 */
function getChangeTone(pct: number | null): {
  tone: ChangeTone;
  className: string;
  Icon: typeof TrendingUp;
  prefix: string;
} {
  if (pct === null || pct === 0) {
    return {
      tone: 'flat',
      className: 'text-muted-foreground',
      Icon: Minus,
      prefix: '',
    };
  }
  if (pct > 0) {
    return {
      tone: 'up',
      className: 'text-emerald-600 dark:text-emerald-500',
      Icon: TrendingUp,
      prefix: '+',
    };
  }
  return {
    tone: 'down',
    className: 'text-red-600 dark:text-red-500',
    Icon: TrendingDown,
    prefix: '',
  };
}

export function SubscriptionKpiCards({
  subscriptions,
  runs,
  itemStats,
}: SubscriptionKpiCardsProps) {
  const activeCount = subscriptions.filter((s) => s.status === 'active').length;
  const pausedCount = subscriptions.filter((s) => s.status === 'paused').length;
  const errorCount = subscriptions.filter((s) => s.status === 'error').length;
  const totalSubs = subscriptions.length;

  // SUBS-001: 구독 0개일 때 KPI는 "시스템 전체 통계"임을 라벨에 명시.
  const hasNoSubscriptions = totalSubs === 0;

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

  // SUBS-009: subtitle을 단순 문자열이 아니라 ReactNode로도 받을 수 있게 분리.
  const collectedSubtitleText = itemStats
    ? `기사 ${articleCount.toLocaleString()} · 영상 ${videoCount.toLocaleString()} · 댓글 ${commentCount.toLocaleString()}`
    : null;

  const change = getChangeTone(changePct);
  const collectedSubtitleNode =
    collectedSubtitleText !== null ? (
      <p className="text-xs text-muted-foreground mt-1 truncate">{collectedSubtitleText}</p>
    ) : changePct !== null ? (
      <p
        className={cn(
          'mt-1 inline-flex items-center gap-1 text-xs font-medium tabular-nums',
          change.className,
        )}
        aria-label={`전일 대비 ${change.prefix}${changePct}퍼센트 ${change.tone === 'up' ? '증가' : change.tone === 'down' ? '감소' : '변동 없음'}`}
      >
        <change.Icon className="h-3 w-3" aria-hidden="true" />
        <span>
          전일 대비 {change.prefix}
          {changePct}%
        </span>
      </p>
    ) : (
      <p className="text-xs text-muted-foreground mt-1 truncate">비교 데이터 없음</p>
    );

  const collectedValue = itemStats
    ? totalItems.toLocaleString() + '건'
    : collected24h.toLocaleString() + '건';

  // SUBS-001: 구독이 0개인데 시스템 전체 runs가 잡혀 있는 경우 라벨로 컨텍스트를 명시.
  const collectedTitle = itemStats
    ? '누적 수집량'
    : hasNoSubscriptions
      ? '시스템 전체 24시간 수집량'
      : '24시간 수집량';

  const successRateTitle = hasNoSubscriptions ? '시스템 전체 실행 성공률' : '실행 성공률';

  // SUBS-011: '0개 활성' 두 단어 묶임 → 메인은 숫자만, 단위와 라벨은 보조.
  const subscriptionMainValue = `${activeCount.toLocaleString()}`;
  const subscriptionUnit = '개 활성';

  type Card = {
    title: string;
    value: string;
    /** 보조 단위(메인 값 옆에 작게 표시) */
    valueSuffix?: string;
    /** subtitle 영역 — ReactNode로 받아 색·아이콘이 있는 변동률을 그릴 수 있게 */
    subtitle: React.ReactNode;
    icon: typeof Database;
    accent: string;
  };

  const cards: Card[] = [
    {
      title: '총 구독',
      value: subscriptionMainValue,
      valueSuffix: subscriptionUnit,
      subtitle: (
        <p className="text-xs text-muted-foreground mt-1 truncate">
          정지 {pausedCount} / 오류 {errorCount}
        </p>
      ),
      icon: Database,
      accent: 'border-t-blue-500',
    },
    {
      title: collectedTitle,
      value: collectedValue,
      subtitle: collectedSubtitleNode,
      icon: TrendingUp,
      accent: 'border-t-emerald-500',
    },
    {
      title: successRateTitle,
      value: `${successRate.toFixed(1)}%`,
      subtitle: (
        <p className="text-xs text-muted-foreground mt-1 truncate">
          최근 24시간 ({completedRuns24h}/{runs24h.length})
        </p>
      ),
      icon: CheckCircle2,
      accent: 'border-t-violet-500',
    },
    {
      title: '다음 수집',
      value: nextRun ? formatRelative(nextRun.nextRunAt) : '예정 없음',
      subtitle: nextRun ? (
        <p className="text-xs text-muted-foreground mt-1 truncate">
          {nextRun.keyword} (
          {(nextRun.sources as string[]).map((s) => SOURCE_LABEL_MAP[s] ?? s).join(', ')})
        </p>
      ) : null,
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
            <p className="text-xl font-bold truncate">
              {card.value}
              {card.valueSuffix ? (
                <span className="text-sm font-medium text-muted-foreground ml-1">
                  {card.valueSuffix}
                </span>
              ) : null}
            </p>
            {card.subtitle}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
