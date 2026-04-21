'use client';

import { ExternalLink, Loader2, X } from 'lucide-react';
import { useMemo } from 'react';
import { formatRelative, SOURCE_LABEL_MAP } from './item-utils';
import { ItemMetricsBadge } from './item-metrics-badge';
import { ItemCommentList } from './item-comment-list';
import { SentimentBadge } from './sentiment-badge';
import type { RawItemRecord, SourceEnum } from '@/server/trpc/routers/subscriptions';
import { useCommentsForParent } from '@/hooks/use-comments-for-parent';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface ItemDetailPanelProps {
  item: RawItemRecord | null;
  subscriptionId: number;
  dateRange: { start: string; end: string };
  onClose: () => void;
}

export function ItemDetailPanel({
  item,
  subscriptionId,
  dateRange,
  onClose,
}: ItemDetailPanelProps) {
  const parent = useMemo(
    () => (item ? { source: item.source as SourceEnum, sourceId: item.sourceId } : null),
    [item],
  );

  const {
    data: commentsData,
    isLoading: commentsLoading,
    isError: commentsError,
  } = useCommentsForParent(subscriptionId, parent, dateRange);

  const comments = useMemo<RawItemRecord[]>(
    () => commentsData?.pages.flatMap((p) => p.items as RawItemRecord[]) ?? [],
    [commentsData],
  );

  if (!item) return null;

  const sourceLabel = SOURCE_LABEL_MAP[item.source] || item.source;

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="border-b pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base line-clamp-2">{item.title}</CardTitle>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <p className="text-xs text-muted-foreground">
                {sourceLabel} · {formatRelative(new Date(item.publishedAt || item.time))}
              </p>
              <SentimentBadge sentiment={item.sentiment} score={item.sentimentScore} size="md" />
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} className="flex-shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto py-4 space-y-4">
        {item.url && (
          <div>
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="w-full">
                <ExternalLink className="h-3.5 w-3.5 mr-1" /> 원문 보기
              </Button>
            </a>
          </div>
        )}

        <div>
          <h4 className="text-sm font-semibold mb-2">본문</h4>
          <ScrollArea className="h-48 border rounded-md p-3 bg-muted/30">
            <p className="text-sm text-foreground whitespace-pre-wrap text-justify">
              {item.content || '본문이 없습니다'}
            </p>
          </ScrollArea>
        </div>

        <Separator />

        {commentsLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : commentsError ? (
          <p className="text-sm text-destructive">댓글을 불러오지 못했습니다</p>
        ) : (
          <ItemCommentList parentSourceId={item.sourceId} comments={comments} />
        )}

        {item.metrics && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-semibold mb-2">통계</h4>
              <ItemMetricsBadge metrics={item.metrics} variant="full" />
            </div>
          </>
        )}

        <Separator />
        <div className="space-y-2 text-xs text-muted-foreground">
          <h4 className="text-sm font-semibold text-foreground">수집 정보</h4>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>수집 시각:</span>
              <span>{new Date(item.fetchedAt).toLocaleString('ko-KR')}</span>
            </div>
            {item.fetchedFromRun && (
              <div className="flex justify-between break-all">
                <span>실행 ID:</span>
                <span className="font-mono text-xs">{item.fetchedFromRun.slice(0, 8)}...</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
