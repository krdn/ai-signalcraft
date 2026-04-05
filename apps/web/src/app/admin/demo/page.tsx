'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { trpcClient } from '@/lib/trpc';

export default function AdminDemoPage() {
  const queryClient = useQueryClient();

  const { data: demoUsers, isLoading } = useQuery({
    queryKey: ['admin', 'demo', 'list'],
    queryFn: () => trpcClient.admin.demo.list.query(),
  });

  const { data: conversionStats } = useQuery({
    queryKey: ['admin', 'demo', 'conversion'],
    queryFn: () => trpcClient.admin.demo.conversionRate.query(),
  });

  const extendQuota = useMutation({
    mutationFn: (userId: string) =>
      trpcClient.admin.demo.updateQuota.mutate({ userId, extendDays: 7 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'demo'] });
      toast.success('쿼터가 연장되었습니다');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetQuota = useMutation({
    mutationFn: (userId: string) => trpcClient.admin.demo.resetQuota.mutate({ userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'demo'] });
      toast.success('쿼터가 리셋되었습니다');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cleanupExpired = useMutation({
    mutationFn: () => trpcClient.admin.demo.cleanupExpired.mutate(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'demo'] });
      toast.success(`만료 계정 ${data.cleaned}개 정리됨`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">데모 관리</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => cleanupExpired.mutate()}
          disabled={cleanupExpired.isPending}
        >
          만료 계정 정리
        </Button>
      </div>

      {/* 전환 통계 */}
      {conversionStats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">총 데모 가입</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{conversionStats.totalDemos}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">체험 사용</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{conversionStats.usedAtLeastOnce}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">정식 전환</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{conversionStats.converted}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">전환율</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{conversionStats.conversionRate}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 데모 사용자 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">데모 사용자 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : demoUsers && demoUsers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>오늘</TableHead>
                  <TableHead>일일 한도</TableHead>
                  <TableHead>누적</TableHead>
                  <TableHead>만료일</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {demoUsers.map((demo) => {
                  const isExpired = new Date(demo.expiresAt) < new Date();
                  const today = new Date().toISOString().slice(0, 10);
                  const todayUsed = demo.todayDate === today ? demo.todayUsed : 0;
                  return (
                    <TableRow key={demo.userId}>
                      <TableCell className="font-medium">{demo.userName ?? '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{demo.userEmail}</TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {todayUsed}/{demo.dailyLimit}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{demo.dailyLimit}회/일</TableCell>
                      <TableCell className="font-mono text-sm">{demo.totalUsed}회</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(demo.expiresAt).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell>
                        {isExpired ? (
                          <Badge variant="destructive">만료</Badge>
                        ) : (
                          <Badge variant="secondary">활성</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => extendQuota.mutate(demo.userId)}
                          >
                            연장
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => resetQuota.mutate(demo.userId)}
                          >
                            리셋
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">데모 사용자가 없습니다</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
