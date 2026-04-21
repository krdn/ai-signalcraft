import { useInfiniteQuery } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc';
import type { SourceEnum } from '@/server/trpc/routers/subscriptions';

interface Parent {
  source: SourceEnum;
  sourceId: string;
}

interface DateRange {
  start: string;
  end: string;
}

/**
 * 선택된 기사(parent)의 댓글을 lazy load 한다.
 * - 뷰어 피드(use-infinite-items)와 별도 queryKey로 분리되어 피드 갱신과 독립.
 * - parent(source, sourceId)가 queryKey에 포함되어 기사 변경 시 자동 리셋.
 */
export function useCommentsForParent(
  subscriptionId: number,
  parent: Parent | null,
  dateRange: DateRange,
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: ['comments-for-parent', subscriptionId, parent?.source, parent?.sourceId, dateRange],
    queryFn: ({ pageParam }) =>
      trpcClient.subscriptions.queryComments.query({
        subscriptionId,
        parent: parent!,
        dateRange,
        cursor: pageParam as string | undefined,
        limit: 100,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: enabled && !!subscriptionId && !!parent,
    staleTime: 60_000,
  });
}
