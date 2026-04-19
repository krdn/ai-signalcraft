'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { SubscriptionList } from '@/components/subscriptions/subscription-list';
import { SubscriptionForm } from '@/components/subscriptions/subscription-form';

export default function SubscriptionsPage() {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard')}
            className="text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            대시보드
          </Button>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />새 구독 등록
        </Button>
      </div>

      <div className="space-y-1">
        <h1 className="text-xl font-semibold">키워드 구독</h1>
        <p className="text-sm text-muted-foreground">
          키워드를 구독하면 수집 서비스가 지정 주기로 자동 수집합니다. 분석은 대시보드에서 축적된
          데이터로 실행합니다.
        </p>
      </div>

      <SubscriptionList
        onAnalyze={(keyword) => {
          router.push(`/dashboard?keyword=${encodeURIComponent(keyword)}`);
        }}
      />

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
    </div>
  );
}
