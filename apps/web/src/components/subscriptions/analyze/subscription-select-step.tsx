'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SubscriptionSummary } from '../subscription-picker';
import { trpcClient } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SourceBadges } from '@/components/analysis/source-icons';
import type { SubscriptionRecord } from '@/server/trpc/routers/subscriptions';

interface SubscriptionSelectStepProps {
  onSelect: (sub: SubscriptionSummary) => void;
}

export function SubscriptionSelectStep({ onSelect }: SubscriptionSelectStepProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions.list', 'active'],
    queryFn: () => trpcClient.subscriptions.list.query({ status: 'active' }),
    staleTime: 30_000,
  });

  const subscriptions: SubscriptionRecord[] = data ?? [];

  if (isLoading) {
    return (
      <div className="py-12 text-center text-muted-foreground">구독 목록을 불러오는 중...</div>
    );
  }

  if (!subscriptions.length) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">활성 구독이 없습니다</p>
        <p className="mt-1 text-sm text-muted-foreground">먼저 구독을 등록해주세요</p>
      </div>
    );
  }

  const handleSelect = () => {
    const sub = subscriptions.find((s) => s.id === selectedId);
    if (!sub) return;
    onSelect({
      id: sub.id,
      keyword: sub.keyword,
      sources: sub.sources,
      limits: sub.limits,
      options: {
        collectTranscript: sub.options?.collectTranscript ?? false,
        includeComments: sub.options?.includeComments ?? true,
      },
      domain: sub.domain,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {subscriptions.map((sub) => (
          <Card
            key={sub.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedId === sub.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setSelectedId(sub.id)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{sub.keyword}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <SourceBadges sources={sub.sources} />
              </div>
              {sub.domain && (
                <Badge variant="outline" className="text-xs">
                  {sub.domain}
                </Badge>
              )}
              <div className="text-xs text-muted-foreground">1회 최대 {sub.limits.maxPerRun}건</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button disabled={!selectedId} onClick={handleSelect}>
          다음
        </Button>
      </div>
    </div>
  );
}
