'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { trpcClient } from '@/lib/trpc';

export function useSubscriptionActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['subscriptions'] });

  const pause = useMutation({
    mutationFn: (id: number) => trpcClient.subscriptions.pause.mutate({ id }),
    onSuccess: () => {
      toast.success('일시 정지되었습니다');
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : '실패'),
  });

  const resume = useMutation({
    mutationFn: (id: number) => trpcClient.subscriptions.resume.mutate({ id }),
    onSuccess: () => {
      toast.success('재개되었습니다');
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : '실패'),
  });

  const remove = useMutation({
    mutationFn: (id: number) => trpcClient.subscriptions.remove.mutate({ id }),
    onSuccess: () => {
      toast.success('삭제되었습니다');
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : '실패'),
  });

  const triggerNow = useMutation({
    mutationFn: (id: number) => trpcClient.subscriptions.triggerNow.mutate({ id }),
    onSuccess: (res) => {
      const sources = Array.isArray(res?.enqueuedSources) ? res.enqueuedSources.join(', ') : '';
      toast.success(`수집이 큐에 등록되었습니다${sources ? ` (${sources})` : ''}`);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : '실패'),
  });

  return { pause, resume, remove, triggerNow, invalidate };
}
