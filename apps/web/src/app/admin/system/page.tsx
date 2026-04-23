'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { trpcClient } from '@/lib/trpc';

const COUNT_LABELS: Record<string, string> = {
  active: '실행 중',
  waiting: '대기',
  delayed: '지연',
  'waiting-children': '하위 대기',
  completed: '완료',
  failed: '실패',
};

const COUNT_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  active: 'default',
  waiting: 'secondary',
  delayed: 'outline',
  'waiting-children': 'outline',
  completed: 'secondary',
  failed: 'destructive',
};

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
          <CardTitle as="h2" className="text-base">
            큐/워커 상태
          </CardTitle>
        </CardHeader>
        <CardContent>
          {queueLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : queueStatus?.queues ? (
            <div className="space-y-4">
              {queueStatus.queues.map(
                (queue: {
                  name: string;
                  counts: Record<string, number>;
                  jobs: Array<{
                    id: string;
                    name: string;
                    state: string;
                    dbJobId: number | null;
                    timestamp: number | null;
                    failedReason: string | null;
                  }>;
                }) => (
                  <div key={queue.name} className="space-y-2">
                    <h3 className="text-sm font-semibold">{queue.name}</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(queue.counts).map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center gap-1.5 rounded-md border px-2.5 py-1"
                        >
                          <Badge
                            variant={COUNT_VARIANTS[key] ?? 'outline'}
                            className="text-[10px] px-1.5"
                          >
                            {COUNT_LABELS[key] ?? key}
                          </Badge>
                          <span className="text-sm font-bold">{value}</span>
                        </div>
                      ))}
                    </div>
                    {queue.jobs.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b text-muted-foreground">
                              <th scope="col" className="text-left py-1 px-2">
                                ID
                              </th>
                              <th scope="col" className="text-left py-1 px-2">
                                작업명
                              </th>
                              <th scope="col" className="text-left py-1 px-2">
                                상태
                              </th>
                              <th scope="col" className="text-left py-1 px-2">
                                DB Job
                              </th>
                              <th scope="col" className="text-left py-1 px-2">
                                시간
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {queue.jobs.map((job) => (
                              <tr key={job.id} className="border-b last:border-0">
                                <td className="py-1 px-2 font-mono">{job.id}</td>
                                <td className="py-1 px-2">{job.name}</td>
                                <td className="py-1 px-2">
                                  <Badge
                                    variant={
                                      job.state === 'failed'
                                        ? 'destructive'
                                        : job.state === 'active'
                                          ? 'default'
                                          : 'outline'
                                    }
                                    className="text-[10px] px-1.5"
                                  >
                                    {job.state}
                                  </Badge>
                                </td>
                                <td className="py-1 px-2">{job.dbJobId ?? '-'}</td>
                                <td className="py-1 px-2 text-muted-foreground">
                                  {job.timestamp
                                    ? new Date(job.timestamp).toLocaleTimeString('ko-KR')
                                    : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">큐 상태를 불러올 수 없습니다</p>
          )}
        </CardContent>
      </Card>

      {/* 등록된 API 키 */}
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-base">
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
          <CardTitle as="h2" className="text-base">
            동시성 설정
          </CardTitle>
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
