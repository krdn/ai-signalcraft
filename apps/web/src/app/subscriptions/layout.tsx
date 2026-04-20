'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { SubscriptionForm } from '@/components/subscriptions/subscription-form';
import { RunActionsModal } from '@/components/subscriptions/run-actions-modal';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: '대시보드', href: '/subscriptions' },
  { label: '모니터링', href: '/subscriptions/monitor' },
  { label: '시스템 건강', href: '/subscriptions/health' },
] as const;

export default function SubscriptionsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const isDetailPage = /^\/subscriptions\/\d+/.test(pathname);

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
            <nav className="hidden md:flex items-center gap-1 ml-4">
              {NAV_ITEMS.map((item) => (
                <Button
                  key={item.href}
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(item.href)}
                  className={cn(
                    'text-sm',
                    pathname === item.href
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground',
                  )}
                >
                  {item.label}
                </Button>
              ))}
            </nav>
          )}
        </div>

        <Button onClick={() => setIsFormOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />새 구독 등록
        </Button>
      </div>

      {children}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
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
