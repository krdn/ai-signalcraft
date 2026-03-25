'use client';

import { useQuery } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc';

// 파이프라인 상태 폴링 훅 -- 5초 간격 (06-01: 3초→5초 조정)
export function usePipelineStatus(jobId: number | null) {
  return useQuery({
    queryKey: ['pipeline', 'getStatus', jobId],
    queryFn: () => trpcClient.pipeline.getStatus.query({ jobId: jobId! }),
    enabled: !!jobId,
    // 완료/실패 시 폴링 중지, 그 외 5초 간격 폴링
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed' || status === 'partial_failure') {
        return false;
      }
      return 5000;
    },
  });
}
