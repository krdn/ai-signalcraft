import type { RawItemRecord } from '@/server/trpc/routers/subscriptions';

type Sentiment = RawItemRecord['sentiment'];

interface SentimentBadgeProps {
  sentiment: Sentiment;
  score?: number | null;
  size?: 'sm' | 'md';
}

const SENTIMENT_META: Record<
  NonNullable<Sentiment>,
  { label: string; emoji: string; className: string }
> = {
  positive: {
    label: '긍정',
    emoji: '😊',
    className: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  },
  negative: {
    label: '부정',
    emoji: '😠',
    className: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  },
  neutral: {
    label: '중립',
    emoji: '😐',
    className: 'bg-muted text-muted-foreground ring-1 ring-border',
  },
};

export function SentimentBadge({ sentiment, score, size = 'sm' }: SentimentBadgeProps) {
  if (!sentiment) return null;
  const meta = SENTIMENT_META[sentiment];
  const scorePct = score != null ? Math.round(score * 100) : null;
  const title = scorePct != null ? `${meta.label} · 확신도 ${scorePct}%` : meta.label;
  const padding = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-0.5';
  const textSize = size === 'sm' ? 'text-[11px]' : 'text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded ${padding} ${textSize} tabular-nums ${meta.className}`}
      title={title}
    >
      <span aria-hidden>{meta.emoji}</span>
      <span>{meta.label}</span>
      {scorePct != null && <span className="opacity-75">{scorePct}%</span>}
    </span>
  );
}
