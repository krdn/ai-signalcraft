import { useInfiniteQuery } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc';
import type { FilterState } from '@/components/subscriptions/items/item-filter-bar';
import type { SourceEnum } from '@/server/trpc/routers/subscriptions';

export function useInfiniteItems(subscriptionId: number, filter: FilterState, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['subscription-items', subscriptionId, filter],
    queryFn: ({ pageParam }) =>
      trpcClient.subscriptions.queryItems.query({
        subscriptionId,
        dateRange: filter.dateRange,
        sources: filter.sources.length > 0 ? (filter.sources as SourceEnum[]) : undefined,
        cursor: pageParam as string | undefined,
        limit: 50,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: enabled && !!subscriptionId,
    staleTime: 60_000,
  });
}
