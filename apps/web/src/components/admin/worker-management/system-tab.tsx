'use client';

import { useQuery } from '@tanstack/react-query';
import { Database, ScrollText, RefreshCw } from 'lucide-react';
import { trpcClient } from '@/lib/trpc';

const ACTION_LABELS: Record<string, string> = {
  pause: '큐 일시정지',
  resume: '큐 재개',
  drain: '큐 비우기',
  'remove-stalled': 'Stalled 정리',
  'retry-failed': 'Failed 재시도',
  'remove-failed': 'Failed 삭제',
  'remove-job': 'Job 제거',
  'cleanup-orphaned': '고아 정리',
};

export function SystemTab() {
  const { data: redisInfo, isLoading: redisLoading } = useQuery({
    queryKey: ['admin', 'workerMgmt', 'redisInfo'],
    queryFn: () => trpcClient.admin.workerMgmt.getRedisInfo.query(),
    refetchInterval: 30_000,
  });

  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: ['admin', 'workerMgmt', 'auditLogs'],
    queryFn: () => trpcClient.admin.workerMgmt.getAuditLogs.query(),
    refetchInterval: 10_000,
  });

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 pt-4">
      <div>
        <div className="mb-3 flex items-center gap-1.5 text-sm font-medium">
          <Database className="h-4 w-4" />
          Redis 현황
        </div>
        {redisLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3 animate-spin" /> 로딩 중...
          </div>
        ) : redisInfo ? (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-border p-3 text-center">
                <div className="font-medium">{redisInfo.usedMemory}</div>
                <div className="text-muted-foreground">사용 메모리</div>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <div className="font-medium">{redisInfo.maxMemory || '무제한'}</div>
                <div className="text-muted-foreground">최대 메모리</div>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <div className="font-medium">{redisInfo.totalKeys.toLocaleString()}</div>
                <div className="text-muted-foreground">총 키 수</div>
              </div>
            </div>
            {redisInfo.prefixCounts.length > 0 && (
              <div className="rounded-lg bg-muted p-3">
                <div className="mb-1.5 text-xs text-muted-foreground">Prefix별 키 분포</div>
                <div className="space-y-1">
                  {redisInfo.prefixCounts.map((p) => (
                    <div key={p.prefix} className="flex justify-between text-xs">
                      <code>{p.prefix}:*</code>
                      <span>{p.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div>
        <div className="mb-3 flex items-center gap-1.5 text-sm font-medium">
          <ScrollText className="h-4 w-4" />
          감사 로그
        </div>
        {auditLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3 animate-spin" /> 로딩 중...
          </div>
        ) : auditLogs && auditLogs.length > 0 ? (
          <div className="rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">시간</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">액션</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">대상</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">결과</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log, i) => (
                  <tr
                    key={`${log.timestamp}-${i}`}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {formatTime(log.timestamp)}
                    </td>
                    <td className="px-3 py-1.5">{ACTION_LABELS[log.action] ?? log.action}</td>
                    <td className="px-3 py-1.5 font-mono text-muted-foreground">{log.target}</td>
                    <td className="px-3 py-1.5">
                      <span
                        className={log.result === 'success' ? 'text-green-600' : 'text-red-600'}
                      >
                        {log.result}
                      </span>
                      {log.count !== undefined && (
                        <span className="ml-1 text-muted-foreground">({log.count})</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-muted-foreground">감사 로그가 없습니다</div>
        )}
      </div>
    </div>
  );
}
