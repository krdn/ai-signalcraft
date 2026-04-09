'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpcClient } from '@/lib/trpc';

interface ReleaseBellProps {
  className?: string;
}

export function ReleaseBell({ className }: ReleaseBellProps) {
  const { data } = useQuery({
    queryKey: ['release', 'unreadCount'],
    queryFn: () => trpcClient.release.unreadCount.query(),
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000, // 5분마다 폴링
  });

  const count = data?.count ?? 0;

  return (
    <Link
      href="/changelog"
      aria-label={`업데이트 히스토리 ${count > 0 ? `(미확인 ${count}건)` : ''}`}
      className={cn(
        'relative inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors',
        className,
      )}
    >
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}
