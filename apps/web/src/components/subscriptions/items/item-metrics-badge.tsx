import { Eye, ThumbsUp, MessageCircle, Share2 } from 'lucide-react';
import type { RawItemRecord } from '@/server/trpc/routers/subscriptions';

interface ItemMetricsBadgeProps {
  metrics: RawItemRecord['metrics'];
  variant?: 'compact' | 'full';
}

function formatCount(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '-';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(1)}조`;
  if (abs >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억`;
  if (abs >= 10_000) return `${(value / 10_000).toFixed(1)}만`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

export function ItemMetricsBadge({ metrics, variant = 'compact' }: ItemMetricsBadgeProps) {
  if (!metrics) return null;

  const items: Array<{ icon: React.ReactNode; label: string; value: number | undefined }> = [
    { icon: <Eye className="h-3.5 w-3.5" />, label: '조회수', value: metrics.viewCount },
    { icon: <ThumbsUp className="h-3.5 w-3.5" />, label: '좋아요', value: metrics.likeCount },
    { icon: <MessageCircle className="h-3.5 w-3.5" />, label: '댓글', value: metrics.commentCount },
    { icon: <Share2 className="h-3.5 w-3.5" />, label: '공유', value: metrics.shareCount },
  ].filter((item) => item.value !== undefined && item.value !== null);

  if (items.length === 0) return null;

  if (variant === 'compact') {
    return (
      <div className="flex gap-2 flex-wrap min-w-0">
        {items.map((item) => (
          <span
            key={item.label}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums"
            title={`${item.label}: ${item.value?.toLocaleString() ?? ''}`}
          >
            {item.icon}
            {formatCount(item.value)}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground flex items-center gap-2">
            {item.icon}
            {item.label}
          </span>
          <span
            className="font-medium tabular-nums truncate"
            title={item.value?.toLocaleString() ?? ''}
          >
            {formatCount(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
