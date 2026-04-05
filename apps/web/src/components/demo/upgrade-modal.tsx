'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { trpcClient } from '@/lib/trpc';

export function UpgradeModal() {
  const { data: session } = useSession();
  const userRole = session?.user?.role;

  const { data: quota } = useQuery({
    queryKey: ['demoAuth', 'quota'],
    queryFn: () => trpcClient.demoAuth.getQuota.query(),
    enabled: userRole === 'demo',
  });

  const shouldShow = quota && quota.isExpired;

  return (
    <Dialog open={!!shouldShow}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {quota?.isExpired ? '체험 기간 만료' : '체험 분석 횟수 소진'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {quota?.isExpired
              ? '무료 체험 기간이 만료되었습니다. 정식 가입 후 모든 기능을 이용해 보세요.'
              : '무료 체험 분석 횟수를 모두 사용했습니다. 정식 가입 후 무제한으로 분석을 실행하세요.'}
          </p>

          <div className="rounded-md bg-muted/50 p-4 space-y-2 text-sm">
            <p className="font-medium">정식 회원이 되면:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>무제한 분석 실행</li>
              <li>14개 전체 AI 분석 모듈</li>
              <li>종합 전략 리포트 생성</li>
              <li>팀 협업 기능</li>
              <li>고급 분석 (위기 시뮬레이션 등)</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Link href="/signup" className={cn(buttonVariants(), 'flex-1')}>
              정식 가입하기
            </Link>
            <Link href="/" className={cn(buttonVariants({ variant: 'outline' }), 'flex-1')}>
              홈으로
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
