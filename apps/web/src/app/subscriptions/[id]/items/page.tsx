'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { trpcClient } from '@/lib/trpc';
import type { RawItemRecord } from '@/server/trpc/routers/subscriptions';
import type { FilterState } from '@/components/subscriptions/items/item-filter-bar';
import { ItemFilterBar } from '@/components/subscriptions/items/item-filter-bar';
import { ItemFeed } from '@/components/subscriptions/items/item-feed';
import { ItemDetailPanel } from '@/components/subscriptions/items/item-detail-panel';
import { Button } from '@/components/ui/button';

export default function SubscriptionItemsPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [selectedItem, setSelectedItem] = useState<RawItemRecord | null>(null);

  const [filterState, setFilterState] = useState<FilterState>(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return {
      sources: [],
      dateRange: {
        start: thirtyDaysAgo.toISOString(),
        end: now.toISOString(),
      },
    };
  });

  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ['subscription', id],
    queryFn: () => trpcClient.subscriptions.get.query({ id }),
  });

  const { data: stats } = useQuery({
    queryKey: ['subscription-stats', id, filterState],
    queryFn: () =>
      trpcClient.subscriptions.itemStats.query({
        subscriptionId: id,
        dateRange: filterState.dateRange,
      }),
    enabled: !!subscription,
  });

  const handleSelectItem = (item: RawItemRecord) => {
    setSelectedItem(item);
  };

  const effectiveFilterState = useMemo(() => {
    if (filterState.sources.length === 0 && subscription?.sources) {
      return { ...filterState, sources: subscription.sources };
    }
    return filterState;
  }, [filterState, subscription]);

  if (subLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">로드 중...</p>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="flex items-center justify-center min-h-screen text-destructive">
        구독을 찾을 수 없습니다
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-screen-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <Button size="sm" variant="ghost" onClick={() => router.push(`/subscriptions/${id}`)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              구독 상세
            </Button>
          </div>
          <h1 className="text-2xl font-bold">{subscription.keyword}</h1>
          <p className="text-sm text-muted-foreground mt-1">수집 데이터 뷰어</p>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] gap-4 auto-rows-max">
        <ItemFilterBar
          subscription={subscription}
          value={effectiveFilterState}
          onChange={setFilterState}
          stats={stats ?? null}
        />

        <div className="lg:row-span-2 lg:sticky lg:top-6 h-fit min-w-0">
          <div className="hidden lg:block">
            <ItemDetailPanel
              item={selectedItem}
              subscriptionId={id}
              dateRange={effectiveFilterState.dateRange}
              onClose={() => setSelectedItem(null)}
            />
          </div>
        </div>

        <div className="min-w-0">
          <ItemFeed
            subscriptionId={id}
            filterState={effectiveFilterState}
            selectedItem={selectedItem}
            onSelectItem={handleSelectItem}
          />
        </div>
      </div>
    </div>
  );
}
