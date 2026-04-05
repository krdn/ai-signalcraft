'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { trpcClient } from '@/lib/trpc';

export default function AdminSystemPage() {
  const { data: queueStatus, isLoading: queueLoading } = useQuery({
    queryKey: ['admin', 'queueStatus'],
    queryFn: () => trpcClient.pipeline.queueStatus.query(),
    refetchInterval: 5000,
  });

  const { data: providerKeys } = useQuery({
    queryKey: ['admin', 'providerKeys'],
    queryFn: () => trpcClient.settings.providerKeys.list.query(),
  });

  const { data: concurrency } = useQuery({
    queryKey: ['admin', 'concurrency'],
    queryFn: () => trpcClient.settings.concurrency.get.query(),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">시스템</h1>

      {/* 큐/워커 상태 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">큐/워커 상태</CardTitle>
        </CardHeader>
        <CardContent>
          {queueLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : queueStatus ? (
            <pre className="text-xs bg-muted/50 rounded-md p-4 overflow-auto max-h-64">
              {JSON.stringify(queueStatus, null, 2)}
            </pre>
          ) : (
            <p className="text-muted-foreground">큐 상태를 불러올 수 없습니다</p>
          )}
        </CardContent>
      </Card>

      {/* 등록된 API 키 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            등록된 AI 프로바이더 ({providerKeys?.length ?? 0}개)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {providerKeys && providerKeys.length > 0 ? (
            <div className="space-y-2">
              {providerKeys.map(
                (key: {
                  id: number;
                  name: string;
                  providerType: string;
                  maskedKey: string | null;
                  isActive: boolean;
                }) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <span className="font-medium text-sm">{key.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{key.providerType}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-muted-foreground">{key.maskedKey ?? '-'}</code>
                      <Badge variant={key.isActive ? 'secondary' : 'outline'}>
                        {key.isActive ? '활성' : '비활성'}
                      </Badge>
                    </div>
                  </div>
                ),
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">등록된 API 키가 없습니다</p>
          )}
        </CardContent>
      </Card>

      {/* 동시성 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">동시성 설정</CardTitle>
        </CardHeader>
        <CardContent>
          {concurrency ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">API 동시성</p>
                <p className="text-lg font-bold">{concurrency.apiConcurrency}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">기사 배치 크기</p>
                <p className="text-lg font-bold">{concurrency.articleBatchSize}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">댓글 배치 크기</p>
                <p className="text-lg font-bold">{concurrency.commentBatchSize}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">활성 프리셋</p>
                <p className="text-lg font-bold">{concurrency.activePreset ?? '커스텀'}</p>
              </div>
            </div>
          ) : (
            <Skeleton className="h-24 w-full" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
