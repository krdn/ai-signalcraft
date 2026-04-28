'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { SubscriptionForm } from '@/components/subscriptions/subscription-form';
import { RunActionsModal } from '@/components/subscriptions/run-actions-modal';
import { OPEN_SUBSCRIPTION_FORM_EVENT } from '@/components/subscriptions/subscription-utils';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: '대시보드', href: '/subscriptions' },
  { label: '모니터링', href: '/subscriptions/monitor' },
  { label: '시스템 건강', href: '/subscriptions/health' },
  { label: '분석 실행', href: '/subscriptions/analyze' },
  { label: '워크플로우', href: '/subscriptions/workflow' },
] as const;

export default function SubscriptionsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const isDetailPage = /^\/subscriptions\/\d+/.test(pathname);

  // SUBS-002: 빈 상태 테이블의 CTA에서 발행하는 글로벌 이벤트를 수신해 모달을 오픈.
  useEffect(() => {
    const handler = () => setIsFormOpen(true);
    window.addEventListener(OPEN_SUBSCRIPTION_FORM_EVENT, handler);
    return () => window.removeEventListener(OPEN_SUBSCRIPTION_FORM_EVENT, handler);
  }, []);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(isDetailPage ? '/subscriptions' : '/dashboard')}
            className="text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {isDetailPage ? '구독 대시보드' : '대시보드'}
          </Button>

          {!isDetailPage && (
            <nav
              className="hidden md:flex items-center gap-1 ml-4"
              aria-label="구독 영역 네비게이션"
            >
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                // SUBS-003: <Button onClick={router.push}> → <Link>로 시멘틱 전환.
                // base-ui Button은 asChild가 없으므로 buttonVariants로 동일 스타일 유지.
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      buttonVariants({ variant: 'ghost', size: 'sm' }),
                      'text-sm',
                      isActive
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'text-muted-foreground',
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        <Button onClick={() => setIsFormOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />새 구독 등록
        </Button>
      </div>

      {children}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        {/*
          SUBS-005: max-h-[85vh] + overflow-y-auto로 긴 폼이 vh를 넘어도 다이얼로그 내부에서
          스크롤되도록 처리. 1440x900 뷰포트 모달 캡처에서 상단 콘텐츠가 박스 밖으로 잘려
          노출되던 클리핑을 방지.
        */}
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>새 키워드 구독</DialogTitle>
            <DialogDescription>
              등록 즉시 첫 수집이 큐에 투입됩니다. 이후 설정된 주기로 자동 반복됩니다.
            </DialogDescription>
          </DialogHeader>
          <SubscriptionForm
            onCreated={() => setIsFormOpen(false)}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <RunActionsModal />
    </div>
  );
}
