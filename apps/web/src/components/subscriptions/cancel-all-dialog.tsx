'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpcClient } from '@/lib/trpc';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/**
 * 전체 긴급 정지 — "CANCEL_ALL" literal 타이핑 필수. force 모드 고정.
 * 모든 active/waiting 수집 job을 즉시 중지. 파괴적 작업이므로 2단계 확인.
 */
export function CancelAllDialog({ open, onOpenChange }: Props) {
  const [input, setInput] = useState('');
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () =>
      trpcClient.subscriptions.cancelAll.mutate({
        mode: 'force',
        confirm: 'CANCEL_ALL',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription-runs-monitor'] });
      qc.invalidateQueries({ queryKey: ['stalled-runs'] });
      qc.invalidateQueries({ queryKey: ['queue-status'] });
      onOpenChange(false);
      setInput('');
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setInput('');
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" /> 전체 긴급 정지
          </DialogTitle>
          <DialogDescription>
            모든 활성 수집 작업이 즉시 force 모드로 중단됩니다. 부분 수집된 데이터는 남습니다.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          계속하려면 아래에 <code className="font-mono bg-muted px-1 rounded">CANCEL_ALL</code>을
          정확히 입력하세요.
        </p>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="CANCEL_ALL"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              setInput('');
            }}
          >
            취소
          </Button>
          <Button
            variant="destructive"
            disabled={input !== 'CANCEL_ALL' || mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? '처리 중...' : '전체 긴급 정지'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
