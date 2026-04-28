'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { trpcClient } from '@/lib/trpc';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface ManipulationViewProps {
  jobId: number;
}

export function ManipulationView({ jobId }: ManipulationViewProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['manipulation', 'run-by-job', jobId],
    queryFn: () => trpcClient.manipulation.getRunByJobId.query({ jobId }),
    refetchInterval: (q) => {
      const d = q.state.data;
      return d && typeof d === 'object' && 'status' in d && d.status === 'running' ? 5000 : false;
    },
  });

  if (isLoading) {
    return (
      <div data-testid="manipulation-skeleton" className="space-y-4 p-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          이 분석은 조작 신호 검출을 활성화하지 않았습니다.
        </p>
        <p className="text-xs text-muted-foreground">
          구독 설정에서 &ldquo;여론 조작 신호 분석&rdquo; 토글을 켜면 다음 분석부터 표시됩니다.
        </p>
      </div>
    );
  }

  if (data.status === 'running') {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        분석 진행 중... (자동 새로고침)
      </div>
    );
  }

  if (data.status === 'failed') {
    const msg =
      data.errorDetails && typeof data.errorDetails === 'object' && 'message' in data.errorDetails
        ? String(data.errorDetails.message)
        : '알 수 없는 오류';
    return (
      <Alert variant="destructive" className="m-6">
        <AlertDescription>{msg}</AlertDescription>
      </Alert>
    );
  }

  // status === 'completed'
  return (
    <div data-testid="manipulation-completed" className="space-y-4 p-6">
      {/* TODO Task 4-5: Hero + SignalGrid + EvidenceCards */}
      <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
