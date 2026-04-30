'use client';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export interface OrphanJobsDialogProps {
  open: boolean;
  count: number;
  onOpenChange: (open: boolean) => void;
  onJustRun: () => void;
  onCleanupAndRun: () => void;
}

export function OrphanJobsDialog({
  open,
  count,
  onOpenChange,
  onJustRun,
  onCleanupAndRun,
}: OrphanJobsDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>이전 작업이 남아있습니다</AlertDialogTitle>
          <AlertDialogDescription>
            이전 실행의 잔여 작업 {count}개가 큐에 남아있습니다. 정리 후 실행하면 충돌을 방지할 수
            있습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <Button variant="outline" onClick={onJustRun}>
            그냥 실행
          </Button>
          <AlertDialogAction onClick={onCleanupAndRun}>정리 후 실행</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
