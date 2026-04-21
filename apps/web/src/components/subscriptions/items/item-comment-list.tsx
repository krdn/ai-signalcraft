import { ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { formatRelative } from './item-utils';
import type { RawItemRecord } from '@/server/trpc/routers/subscriptions';
import { Button } from '@/components/ui/button';

interface ItemCommentListProps {
  parentSourceId: string;
  comments: RawItemRecord[];
}

export function ItemCommentList({ parentSourceId, comments }: ItemCommentListProps) {
  const [expanded, setExpanded] = useState(false);

  const filtered = comments.filter((c) => c.parentSourceId === parentSourceId);
  const displayed = expanded ? filtered : filtered.slice(0, 5);
  const hasMore = filtered.length > 5;

  if (filtered.length === 0) {
    return <p className="text-sm text-muted-foreground">댓글이 없습니다</p>;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">댓글 ({filtered.length})</h4>
      <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
        {displayed.map((comment, idx) => (
          <div
            key={`${idx}-${comment.source}-${comment.sourceId}`}
            className="text-xs border-l-2 border-muted pl-2 py-1"
          >
            <div className="font-medium">{comment.author || '익명'}</div>
            <div className="text-muted-foreground line-clamp-3 my-1">{comment.content}</div>
            <div className="flex items-center gap-2 text-muted-foreground">
              {comment.metrics?.likeCount !== undefined && (
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-2.5 w-2.5" />
                  {comment.metrics.likeCount}
                </span>
              )}
              <span>{formatRelative(new Date(comment.publishedAt || comment.time))}</span>
            </div>
          </div>
        ))}
      </div>
      {hasMore && !expanded && (
        <Button size="sm" variant="ghost" className="w-full" onClick={() => setExpanded(true)}>
          댓글 {filtered.length - 5}개 더 보기
        </Button>
      )}
    </div>
  );
}
