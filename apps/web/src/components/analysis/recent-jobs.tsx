'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarRange, Clock, FileText, LinkIcon, MessageSquare, Star } from 'lucide-react';
import { SourceBadges, extractSources, summarizeCounts, formatDuration } from './source-icons';
import { DomainBadge } from './domain-badge';
import { JobDiagnosticModal } from './job-diagnostic-modal';
import { trpcClient } from '@/lib/trpc';
import { FilterScopePicker, type FilterScopeValue } from '@/components/filter-scope-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';

const STATUS_BADGE: Record<
  string,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }
> = {
  completed: { variant: 'default', label: '완료' },
  running: { variant: 'secondary', label: '진행 중' },
  pending: { variant: 'outline', label: '대기' },
  failed: { variant: 'destructive', label: '실패' },
  partial_failure: { variant: 'outline', label: '부분 실패' },
};

interface RecentJobsProps {
  onSelectJob?: (jobId: number) => void;
  onSelectShowcase?: (jobId: number) => void;
}

export function RecentJobs({ onSelectJob, onSelectShowcase }: RecentJobsProps) {
  const { data: session } = useSession();
  const role = session?.user?.role as string | undefined;
  const isDemo = role === 'demo';
  const canUseAdvancedScope = role === 'admin' || role === 'leader';
  const defaultScope: FilterScopeValue['scope'] = canUseAdvancedScope ? 'team' : 'mine';

  const [scopeValue, setScopeValue] = useState<FilterScopeValue>({ scope: defaultScope });

  const { data, isLoading } = useQuery({
    queryKey: [
      'history',
      'list',
      { page: 1, perPage: 5, scope: scopeValue.scope, targetUserId: scopeValue.targetUserId },
    ],
    queryFn: () =>
      trpcClient.history.list.query({
        page: 1,
        perPage: 5,
        scope: scopeValue.scope,
        targetUserId: scopeValue.targetUserId,
      }),
  });

  // 데모 사용자: 쇼케이스 항목도 조회
  const { data: showcaseItems } = useQuery({
    queryKey: ['showcase', 'list'],
    queryFn: () => trpcClient.showcase.list.query(),
    enabled: isDemo,
  });

  const userJobCount = data?.items.length ?? 0;
  const showShowcase = isDemo && userJobCount < 3 && showcaseItems && showcaseItems.length > 0;

  if (isLoading) {
    return (
      <Card className="mx-auto max-w-3xl mt-4">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg font-semibold">최근 분석</CardTitle>
          {canUseAdvancedScope && <FilterScopePicker value={scopeValue} onChange={setScopeValue} />}
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.items.length && !showShowcase) {
    return (
      <Card className="mx-auto max-w-3xl mt-4">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg font-semibold">최근 분석</CardTitle>
          {canUseAdvancedScope && <FilterScopePicker value={scopeValue} onChange={setScopeValue} />}
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p className="font-semibold">분석 내역이 없습니다</p>
            <p className="text-sm mt-1">키워드를 입력하고 분석을 실행해 보세요.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className="mx-auto max-w-3xl mt-4">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg font-semibold">최근 분석</CardTitle>
          {canUseAdvancedScope && <FilterScopePicker value={scopeValue} onChange={setScopeValue} />}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>날짜</TableHead>
                <TableHead>키워드</TableHead>
                <TableHead>소스</TableHead>
                <TableHead>수집</TableHead>
                <TableHead>상태</TableHead>
                {scopeValue.scope !== 'mine' && <TableHead>실행자</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* 사용자 자신의 분석 */}
              {data?.items.map((job) => {
                const badgeInfo = STATUS_BADGE[job.status ?? 'pending'] ?? STATUS_BADGE.pending;
                const sources = extractSources(job.progress);
                const counts = summarizeCounts(job.progress);
                const isCompleted = job.status === 'completed' || job.status === 'partial_failure';
                return (
                  <TableRow
                    key={job.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onSelectJob?.(job.id)}
                  >
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      <div>{format(new Date(job.createdAt), 'MM-dd HH:mm')}</div>
                      {isCompleted && (
                        <div className="flex items-center gap-0.5 text-muted-foreground mt-0.5">
                          <Clock className="h-3 w-3" />
                          <span>{formatDuration(job.createdAt, job.updatedAt)}</span>
                        </div>
                      )}
                      {job.startDate && job.endDate && (
                        <div className="flex items-center gap-0.5 text-muted-foreground mt-0.5">
                          <CalendarRange className="h-3 w-3" />
                          <span>
                            {format(new Date(job.startDate), 'MM.dd')}~
                            {format(new Date(job.endDate), 'MM.dd')}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{job.keyword}</span>
                        <DomainBadge domain={(job as any).domain} size="xs" />
                        {(job as any).seriesId && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5">
                            <LinkIcon className="h-2.5 w-2.5" />#
                            {((job as any).seriesOrder ?? 0) + 1}
                          </Badge>
                        )}
                        <JobDiagnosticModal jobId={job.id} keyword={job.keyword} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <SourceBadges sources={sources} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {counts.items > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-0.5">
                            <FileText className="h-3 w-3" />
                            {counts.items}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <MessageSquare className="h-3 w-3" />
                            {counts.comments}
                          </span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badgeInfo.variant}>{badgeInfo.label}</Badge>
                    </TableCell>
                    {scopeValue.scope !== 'mine' && (
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {(job as any).userName ?? '-'}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}

              {/* 데모 사용자: 쇼케이스 샘플 */}
              {showShowcase && (
                <>
                  {userJobCount > 0 && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                          <Star className="h-3 w-3 text-primary" />
                          <span>샘플 분석 결과</span>
                          <div className="flex-1 border-t border-border/50" />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {showcaseItems.map((item) => (
                    <TableRow
                      key={`showcase-${item.jobId}`}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onSelectShowcase?.(item.jobId)}
                    >
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        <div>
                          {format(new Date(item.startDate), 'MM.dd')}~
                          {format(new Date(item.endDate), 'MM.dd')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{item.keyword}</span>
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            샘플
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">-</TableCell>
                      <TableCell className="text-xs text-muted-foreground">-</TableCell>
                      <TableCell>
                        <Badge variant="default">완료</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
