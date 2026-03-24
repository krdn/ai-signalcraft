'use client';

import { useQuery } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc';

// 파이프라인 상태 폴링 훅 -- 3초 간격 (D-11)
export function usePipelineStatus(jobId: number | null) {
  return useQuery({
    queryKey: ['pipeline', 'getStatus', jobId],
    queryFn: () => trpcClient.pipeline.getStatus.query({ jobId: jobId! }),
    enabled: !!jobId,
    // 완료/실패 시 폴링 중지, 그 외 3초 간격 폴링
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed' || status === 'partial_failure') {
        return false;
      }
      return 3000;
    },
  });
}
