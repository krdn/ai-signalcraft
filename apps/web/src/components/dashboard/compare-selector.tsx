'use client';

import { useQuery } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { GitCompareArrows, Check } from 'lucide-react';
import { format } from 'date-fns';

interface CompareSelectorProps {
  currentJobId: number;
  compareJobId: number | null;
  onSelect: (jobId: number | null) => void;
}

export function CompareSelector({ currentJobId, compareJobId, onSelect }: CompareSelectorProps) {
  const { data } = useQuery({
    queryKey: ['history', 'list', { page: 1, perPage: 10 }],
    queryFn: () => trpcClient.history.list.query({ page: 1, perPage: 10 }),
  });

  const completedJobs = data?.items.filter(
    (job) => job.status === 'completed' && job.id !== currentJobId
  ) ?? [];

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors">
          <GitCompareArrows className="h-4 w-4" />
          {compareJobId ? '비교 중' : '비교 분석'}
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1">
            비교할 분석 결과 선택
          </p>
          {completedJobs.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-3 text-center">
              비교 가능한 분석이 없습니다
            </p>
          ) : (
            <div className="space-y-0.5 max-h-60 overflow-y-auto">
              {completedJobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => onSelect(compareJobId === job.id ? null : job.id)}
                  className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{job.keyword}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(job.createdAt), 'MM/dd HH:mm')}
                    </p>
                  </div>
                  {compareJobId === job.id && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
      {compareJobId && (
        <Button variant="ghost" size="sm" onClick={() => onSelect(null)} className="text-xs text-muted-foreground">
          비교 해제
        </Button>
      )}
    </div>
  );
}
