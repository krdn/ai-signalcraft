'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type { FilterState } from './item-filter-bar';
import { ItemCard } from './item-card';
import { useInfiniteItems } from '@/hooks/use-infinite-items';
import { trpcClient } from '@/lib/trpc';
import type { RawItemRecord, SourceEnum } from '@/server/trpc/routers/subscriptions';

interface ItemFeedProps {
  subscriptionId: number;
  filterState: FilterState;
  selectedItem: RawItemRecord | null;
  onSelectItem: (item: RawItemRecord, allComments: RawItemRecord[]) => void;
}

export function ItemFeed({
  subscriptionId,
  filterState,
  selectedItem,
  onSelectItem,
}: ItemFeedProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } =
    useInfiniteItems(subscriptionId, filterState);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allItems = data?.pages.flatMap((p) => p.items) ?? [];
  const feedItems = allItems.filter((i) => i.itemType !== 'comment');
  const commentItems = allItems.filter((i) => i.itemType === 'comment');

  const loadedCommentCountByParent = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of commentItems) {
      if (!c.parentSourceId) continue;
      map.set(
        `${c.source}::${c.parentSourceId}`,
        (map.get(`${c.source}::${c.parentSourceId}`) ?? 0) + 1,
      );
    }
    return map;
  }, [commentItems]);

  const { data: serverCommentCounts } = useQuery({
    queryKey: ['comment-count-by-parent', subscriptionId, filterState],
    queryFn: () =>
      trpcClient.subscriptions.commentCountByParent.query({
        subscriptionId,
        dateRange: filterState.dateRange,
        sources: filterState.sources.length > 0 ? (filterState.sources as SourceEnum[]) : undefined,
      }),
    enabled: !!subscriptionId,
    staleTime: 60_000,
  });

  const serverCommentCountByParent = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of serverCommentCounts ?? []) {
      if (!r.parentSourceId) continue;
      map.set(`${r.source}::${r.parentSourceId}`, r.count);
    }
    return map;
  }, [serverCommentCounts]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-sm text-destructive p-4">
        데이터를 불러오는 중에 오류가 발생했습니다
      </div>
    );
  }

  if (feedItems.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground p-8">
        표시할 기사나 영상이 없습니다
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {feedItems.map((item, idx) => {
        const key = `${item.source}::${item.sourceId}`;
        const serverCount = serverCommentCountByParent.get(key);
        const loadedCount = loadedCommentCountByParent.get(key) ?? 0;
        const metricCommentCount = item.metrics?.commentCount ?? null;
        // 우선순위: metrics(소스가 제공하는 공식 수치) → 서버 집계 → 로드된 댓글로 추정
        const commentCount =
          metricCommentCount !== null && metricCommentCount !== undefined
            ? metricCommentCount
            : serverCount !== undefined
              ? serverCount
              : loadedCount;
        return (
          <ItemCard
            key={`${idx}-${item.source}-${item.sourceId}`}
            item={item}
            commentCount={commentCount}
            isSelected={
              selectedItem?.sourceId === item.sourceId && selectedItem?.source === item.source
            }
            onClick={() => onSelectItem(item, commentItems)}
          />
        );
      })}

      <div ref={sentinelRef} className="h-4" />

      {isFetchingNextPage && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {!hasNextPage && feedItems.length > 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">더 이상 데이터가 없습니다</p>
      )}
    </div>
  );
}
