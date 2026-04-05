'use client';

import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { trpcClient } from '@/lib/trpc';

const PROGRAM_LABELS: Record<string, string> = {
  reseller: '리셀러',
  partner: '사업 파트너',
};

const STATUS_MAP: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  active: { label: '활성', variant: 'default' },
  expired: { label: '만료', variant: 'secondary' },
  terminated: { label: '해지', variant: 'destructive' },
};

export default function PartnerContractPage() {
  const { data: contract, isLoading } = useQuery({
    queryKey: ['partner', 'contract'],
    queryFn: () => trpcClient.partner.myContract.query(),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">계약 정보</h1>
        <Card>
          <CardContent className="pt-6 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-48" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">계약 정보</h1>
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <FileText className="mb-4 size-12 text-muted-foreground" />
            <p className="text-muted-foreground">활성 계약이 없습니다</p>
            <p className="mt-1 text-sm text-muted-foreground">관리자에게 문의해주세요</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusInfo = STATUS_MAP[contract.status] ?? {
    label: contract.status,
    variant: 'secondary' as const,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">계약 정보</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>파트너 계약</CardTitle>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-sm text-muted-foreground">프로그램</div>
              <div className="mt-1 font-medium">
                {PROGRAM_LABELS[contract.programType] ?? contract.programType}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">수수료율</div>
              <div className="mt-1 text-2xl font-bold text-primary">{contract.commissionRate}%</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">계약 시작일</div>
              <div className="mt-1 font-medium">
                {new Date(contract.contractStart).toLocaleDateString('ko-KR')}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">계약 종료일</div>
              <div className="mt-1 font-medium">
                {contract.contractEnd
                  ? new Date(contract.contractEnd).toLocaleDateString('ko-KR')
                  : '무기한'}
              </div>
            </div>
          </div>
          {contract.responsibilities && (
            <div>
              <div className="text-sm text-muted-foreground">담당 업무</div>
              <div className="mt-1 rounded-lg bg-muted/50 p-3 text-sm">
                {contract.responsibilities}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
