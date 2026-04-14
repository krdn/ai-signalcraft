'use client';

import {
  TrendingUp,
  TrendingDown,
  Minus,
  MessageSquare,
  BarChart3,
  Hash,
  Activity,
} from 'lucide-react';
import { CardHelp, DASHBOARD_HELP } from './card-help';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KpiCardsProps {
  totalMentions: number | null;
  articleCount?: number | null;
  commentCount?: number | null;
  sentimentRatio: { positive: number; negative: number; neutral: number } | null;
  topKeyword: string | null;
  overallDirection: 'positive' | 'negative' | 'mixed' | null;
}

const directionConfig = {
  positive: { label: '긍정적', icon: TrendingUp, color: 'text-emerald-500' },
  negative: { label: '부정적', icon: TrendingDown, color: 'text-red-500' },
  mixed: { label: '혼합', icon: Minus, color: 'text-amber-500' },
} as const;

export function KpiCards({
  totalMentions,
  articleCount,
  commentCount,
  sentimentRatio,
  topKeyword,
  overallDirection,
}: KpiCardsProps) {
  const direction = overallDirection ? directionConfig[overallDirection] : null;
  const DirectionIcon = direction?.icon ?? Activity;

  // 감성 비율 중 가장 높은 것
  const dominantSentiment = sentimentRatio
    ? sentimentRatio.positive >= sentimentRatio.negative
      ? {
          label: '긍정',
          value: Math.round(sentimentRatio.positive * 100),
          color: 'text-emerald-500',
        }
      : { label: '부정', value: Math.round(sentimentRatio.negative * 100), color: 'text-red-500' }
    : null;

  const CARD_ACCENT: Record<string, string> = {
    '총 수집량': 'border-t-2 border-t-blue-500',
    '주요 감성': 'border-t-2 border-t-emerald-500',
    '핵심 키워드': 'border-t-2 border-t-violet-500',
    '여론 방향': 'border-t-2 border-t-amber-400',
  };

  const cards = [
    {
      title: '총 수집량',
      value: totalMentions !== null ? totalMentions.toLocaleString() : '—',
      subtitle:
        articleCount != null && commentCount != null
          ? `기사 ${articleCount.toLocaleString()} · 댓글 ${commentCount.toLocaleString()}`
          : '기사 + 댓글',
      icon: MessageSquare,
    },
    {
      title: '주요 감성',
      value: dominantSentiment ? `${dominantSentiment.label} ${dominantSentiment.value}%` : '—',
      subtitle: sentimentRatio
        ? `긍정 ${Math.round(sentimentRatio.positive * 100)}% · 부정 ${Math.round(sentimentRatio.negative * 100)}% · 중립 ${Math.round(sentimentRatio.neutral * 100)}%`
        : '',
      icon: BarChart3,
      valueColor: dominantSentiment?.color,
    },
    {
      title: '핵심 키워드',
      value: topKeyword ?? '—',
      subtitle: '최다 언급',
      icon: Hash,
    },
    {
      title: '여론 방향',
      value: direction?.label ?? '—',
      subtitle: '전체 흐름',
      icon: DirectionIcon,
      valueColor: direction?.color,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card
          key={card.title}
          className={cn(
            'border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all',
            CARD_ACCENT[card.title],
          )}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <card.icon className="h-4 w-4" />
              <span className="text-xs font-medium flex-1">{card.title}</span>
              {card.title === '총 수집량' && <CardHelp {...DASHBOARD_HELP.kpi} />}
            </div>
            <p className={`text-xl font-bold truncate ${card.valueColor ?? ''}`}>{card.value}</p>
            {card.subtitle && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{card.subtitle}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
