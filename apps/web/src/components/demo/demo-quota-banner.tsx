'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { trpcClient } from '@/lib/trpc';

export function DemoQuotaBanner() {
  const { data: session } = useSession();
  const [dismissed, setDismissed] = useState(false);

  const userRole = (session?.user as Record<string, unknown> | undefined)?.role as
    | string
    | undefined;

  const { data: quota } = useQuery({
    queryKey: ['demoAuth', 'quota'],
    queryFn: () => trpcClient.demoAuth.getQuota.query(),
    enabled: userRole === 'demo',
  });

  if (userRole !== 'demo' || !quota || dismissed) return null;

  const isExhausted = quota.todayRemaining <= 0;
  const isExpired = quota.isExpired;
  const isUrgent = isExpired || quota.daysLeft <= 2;

  return (
    <div
      className={`relative flex items-center justify-between rounded-lg px-4 py-3 text-sm ${
        isUrgent || isExhausted
          ? 'bg-destructive/10 border border-destructive/20 text-destructive'
          : 'bg-primary/10 border border-primary/20 text-primary'
      }`}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0" />
        <span>
          {isExpired
            ? '데모 체험 기간이 만료되었습니다.'
            : isExhausted
              ? '오늘 분석 횟수를 모두 사용했습니다. 내일 다시 이용하거나 정식 가입하세요.'
              : `무료 체험 중 — 오늘 남은 분석: ${quota.todayRemaining}/${quota.dailyLimit}회 | ${quota.daysLeft}일 후 만료`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/signup"
          className={cn(
            buttonVariants({ size: 'sm', variant: isUrgent ? 'destructive' : 'default' }),
            'text-xs',
          )}
        >
          정식 가입하기
        </Link>
        {!isUrgent && (
          <button
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
