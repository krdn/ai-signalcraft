'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Database } from 'lucide-react';
import { trpcClient } from '@/lib/trpc';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { SubscriptionRecord } from '@/server/trpc/routers/subscriptions';

export interface SubscriptionSummary {
  id: number;
  keyword: string;
  sources: string[];
  limits: { maxPerRun: number; maxPerDay?: number; commentsPerItem?: number };
  options: { collectTranscript?: boolean; includeComments?: boolean };
  domain?: string | null;
}

interface SubscriptionPickerProps {
  onSelect: (subscription: SubscriptionSummary) => void;
  disabled?: boolean;
}

export function SubscriptionPicker({ onSelect, disabled }: SubscriptionPickerProps) {
  const [open, setOpen] = useState(false);
  const [hasError, setHasError] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['subscriptions.list', 'active'],
    queryFn: () => trpcClient.subscriptions.list.query({ status: 'active' }),
    retry: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (error) setHasError(true);
  }, [error]);

  const subs: SubscriptionRecord[] = data ?? [];
  const hasSubs = subs.length > 0;
  const available = !hasError && !isLoading && hasSubs;

  const buttonClass = [
    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors',
    available ? 'hover:bg-accent hover:text-accent-foreground' : 'cursor-not-allowed opacity-50',
  ].join(' ');

  const title = hasError
    ? '구독 서비스에 연결할 수 없습니다'
    : isLoading
      ? '구독 목록 로딩 중'
      : hasSubs
        ? '수집 중인 키워드에서 선택'
        : '활성 구독이 없습니다';

  const handleSelect = (sub: SubscriptionRecord) => {
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
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={disabled || !available}
        className={buttonClass}
        title={title}
      >
        <Database className="h-3.5 w-3.5" />
        구독에서 선택
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2 text-xs text-muted-foreground">
          활성 구독 {subs.length}개
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {subs.map((sub) => (
            <button
              key={sub.id}
              type="button"
              onClick={() => handleSelect(sub)}
              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <span className="truncate font-medium">{sub.keyword}</span>
              <span className="truncate text-xs text-muted-foreground">
                {sub.sources.join(', ')} · {sub.intervalHours}h
              </span>
            </button>
          ))}
          {!hasSubs && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              활성 구독이 없습니다.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
