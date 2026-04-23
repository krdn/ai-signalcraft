'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { trpcClient } from '@/lib/trpc';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> =
  {
    pending: { label: '대기', variant: 'secondary' },
    confirmed: { label: '확정', variant: 'default' },
    paid: { label: '지급완료', variant: 'outline' },
  };

export default function PartnerCommissionsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['partner', 'commissions', page],
    queryFn: () => trpcClient.partner.myCommissions.query({ page, pageSize: 20 }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">수수료 내역</h1>
        <p className="text-muted-foreground">월별 수수료 현황을 확인하세요</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <caption className="sr-only">수수료 내역</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>기간</TableHead>
                  <TableHead>고객</TableHead>
                  <TableHead className="text-right">매출</TableHead>
                  <TableHead className="text-right">수수료율</TableHead>
                  <TableHead className="text-right">수수료</TableHead>
                  <TableHead>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      수수료 내역이 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.items.map((item) => {
                    const statusInfo = STATUS_MAP[item.status] ?? {
                      label: item.status,
                      variant: 'secondary' as const,
                    };
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.periodMonth}</TableCell>
                        <TableCell>
                          {item.clientName}
                          {item.clientCompany && (
                            <div className="text-xs text-muted-foreground">
                              {item.clientCompany}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.clientRevenue.toLocaleString()}만원
                        </TableCell>
                        <TableCell className="text-right">{item.commissionRate}%</TableCell>
                        <TableCell className="text-right font-medium text-primary">
                          {item.commissionAmount.toLocaleString()}만원
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data && data.total > 20 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            이전
          </Button>
          <span className="flex items-center text-sm text-muted-foreground">
            {page} / {Math.ceil(data.total / 20)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(data.total / 20)}
          >
            다음
          </Button>
        </div>
      )}
    </div>
  );
}
