import { Captions, MessageCircle, Newspaper, Video } from 'lucide-react';
import { formatRelative, SOURCE_LABEL_MAP } from './item-utils';
import { ItemMetricsBadge } from './item-metrics-badge';
import { SentimentBadge } from './sentiment-badge';
import type { RawItemRecord } from '@/server/trpc/routers/subscriptions';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ItemCardProps {
  item: RawItemRecord;
  commentCount?: number;
  isSelected: boolean;
  onClick: () => void;
}

export function ItemCard({ item, commentCount, isSelected, onClick }: ItemCardProps) {
  const icon =
    item.itemType === 'video' ? <Video className="h-4 w-4" /> : <Newspaper className="h-4 w-4" />;
  const sourceLabel = SOURCE_LABEL_MAP[item.source] || item.source;
  const hasMetricsComment =
    item.metrics?.commentCount !== undefined && item.metrics?.commentCount !== null;
  const showStandaloneCommentCount =
    !hasMetricsComment && commentCount !== undefined && commentCount > 0;

  return (
    <Card
      className={`p-3 cursor-pointer transition-all min-w-0 ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'}`}
      onClick={onClick}
    >
      <div className="space-y-2 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs flex-shrink-0">
            {sourceLabel}
          </Badge>
          <Badge variant="outline" className="text-xs flex-shrink-0 flex items-center gap-1">
            {icon}
            {item.itemType === 'video' ? '영상' : '기사'}
          </Badge>
          <SentimentBadge sentiment={item.sentiment} score={item.sentimentScore} />
          {item.transcript && item.transcript.length > 0 && (
            <Badge
              variant="outline"
              className="text-xs flex-shrink-0 flex items-center gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
              title={`자막 ${item.transcript.length.toLocaleString()}자 (${item.transcriptLang ?? '?'})`}
            >
              <Captions className="h-3 w-3" />
              자막
            </Badge>
          )}
        </div>

        <h3 className="text-sm font-medium line-clamp-2 leading-snug break-words">
          {item.title || '제목 없음'}
        </h3>

        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{item.publisher || ''}</span>
          <span className="flex-shrink-0">
            {formatRelative(new Date(item.publishedAt || item.time))}
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {item.metrics && <ItemMetricsBadge metrics={item.metrics} variant="compact" />}
          {showStandaloneCommentCount && (
            <span
              className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums"
              title={`수집된 댓글 ${commentCount}개`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {commentCount}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
