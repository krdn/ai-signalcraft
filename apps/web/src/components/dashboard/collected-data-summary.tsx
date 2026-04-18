'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Newspaper, MessageSquare, Video, Users } from 'lucide-react';
import { SOURCE_LABELS } from './collected-data-shared';
import { CollectionTimeline, type TimelineBasis } from './summary-widgets/collection-timeline';
import { LimitProgress } from './summary-widgets/limit-progress';
import { SourceTypeBreakdown } from './summary-widgets/source-type-breakdown';
import { trpcClient } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export interface SummaryViewProps {
  jobId: number;
}

// 수집 통계 요약
export function SummaryView({ jobId }: SummaryViewProps) {
  const [timelineBasis, setTimelineBasis] = useState<TimelineBasis>('published');

  const { data, isLoading } = useQuery({
    queryKey: ['collectedData', 'getSummary', jobId],
    queryFn: () => trpcClient.collectedData.getSummary.query({ jobId }),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['collectedData', 'getCollectionStats', jobId, timelineBasis],
    queryFn: () => trpcClient.collectedData.getCollectionStats.query({ jobId, timelineBasis }),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
                <Newspaper className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.totalArticles}</p>
                <p className="text-sm text-muted-foreground">기사/게시글</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950">
                <Video className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.totalVideos ?? 0}</p>
                <p className="text-sm text-muted-foreground">영상</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950">
                <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.totalComments}</p>
                <p className="text-sm text-muted-foreground">댓글</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950">
                <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.sourceBreakdown.length}</p>
                <p className="text-sm text-muted-foreground">수집 소스</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 신규: 날짜별 수집 타임라인 */}
      {statsLoading ? (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[240px]" />
          </CardContent>
        </Card>
      ) : stats ? (
        <CollectionTimeline
          timeline={stats.timeline}
          basis={timelineBasis}
          onBasisChange={setTimelineBasis}
          outOfRange={stats.outOfRange}
          executionKstDate={stats.executionKstDate}
          futureDates={stats.futureDates}
        />
      ) : null}

      {/* 신규: 한도 대비 실제 + 매체×타입 */}
      {statsLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-48" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-48" />
            </CardContent>
          </Card>
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <LimitProgress
            limits={stats.limits}
            limitsSource={stats.limitsSource}
            limitMode={stats.limitMode}
            dayCount={stats.dayCount}
            rawLimits={stats.rawLimits}
            activeCommunityCount={stats.activeCommunityCount}
          />
          <SourceTypeBreakdown byTypeAndSource={stats.byTypeAndSource} />
        </div>
      ) : null}

      {/* 소스별 분포 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">소스별 수집 분포</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(() => {
              const totalItems = data.totalArticles + (data.totalVideos ?? 0);
              return data.sourceBreakdown.map((s) => (
                <div key={s.source} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{SOURCE_LABELS[s.source] ?? s.source}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{
                          width: `${totalItems > 0 ? Math.min(100, (s.count / totalItems) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-12 text-right">
                      {s.count}건
                    </span>
                  </div>
                </div>
              ));
            })()}
          </div>
        </CardContent>
      </Card>

      {/* 수집 기간 */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            키워드: <span className="font-medium text-foreground">{data.keyword}</span>
          </span>
          <span>
            {new Date(data.period.start).toLocaleDateString('ko-KR')} ~{' '}
            {new Date(data.period.end).toLocaleDateString('ko-KR')}
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
