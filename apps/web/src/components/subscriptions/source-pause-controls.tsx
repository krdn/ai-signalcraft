'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pause, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { trpcClient } from '@/lib/trpc';
import type { SourceState } from '@/server/trpc/routers/subscriptions';

type CollectorSource = 'naver-news' | 'youtube' | 'dcinside' | 'fmkorea' | 'clien';

const SOURCES: CollectorSource[] = ['naver-news', 'youtube', 'dcinside', 'fmkorea', 'clien'];

/**
 * 시스템 전역 소스 일시정지 제어.
 * subscriptions.pause(개별 구독)와 구별 — 이 스위치는 해당 source의 모든 구독 enqueue를 차단.
 * 실행 중인 job에는 영향 없음 (cooperative cancel로 별도 처리).
 */
export function SourcePauseControls() {
  const qc = useQueryClient();
  const [pausingSource, setPausingSource] = useState<CollectorSource | null>(null);
  const [reason, setReason] = useState('');

  const statesQuery = useQuery({
    queryKey: ['source-states'],
    queryFn: () => trpcClient.subscriptions.sourceList.query(),
    refetchInterval: 30_000,
  });

  const pauseMut = useMutation({
    mutationFn: (args: { source: CollectorSource; reason: string | null }) =>
      trpcClient.subscriptions.sourcePause.mutate(args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['source-states'] });
      setPausingSource(null);
      setReason('');
    },
  });

  const resumeMut = useMutation({
    mutationFn: (source: CollectorSource) =>
      trpcClient.subscriptions.sourceResume.mutate({ source }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['source-states'] });
    },
  });

  const states = (statesQuery.data ?? []) as SourceState[];
  const stateMap = new Map(states.map((s) => [s.source, s]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">소스 제어 (시스템 전역)</CardTitle>
        <p className="text-xs text-muted-foreground">
          구독 일시정지(개별 키워드)와 별개 — 이 스위치는 모든 구독의 해당 소스 enqueue를
          차단합니다. 실행 중인 job은 영향 없음.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {SOURCES.map((source) => {
          const s = stateMap.get(source);
          const paused = !!s && s.resumedAt === null;
          return (
            <div key={source} className="flex items-center gap-2 text-sm py-1 flex-wrap">
              <span className="min-w-[100px] font-medium">{source}</span>
              {paused ? (
                <>
                  <Badge variant="secondary">⏸ 정지됨</Badge>
                  {s?.reason && (
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                      ({s.reason})
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-7 gap-1 px-2 text-xs"
                    disabled={resumeMut.isPending}
                    onClick={() => resumeMut.mutate(source)}
                  >
                    <Play className="h-3 w-3" /> 재개
                  </Button>
                </>
              ) : pausingSource === source ? (
                <>
                  <Input
                    className="h-7 text-xs max-w-[200px]"
                    placeholder="사유 (선택)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs"
                    disabled={pauseMut.isPending}
                    onClick={() => pauseMut.mutate({ source, reason: reason || null })}
                  >
                    확정
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => {
                      setPausingSource(null);
                      setReason('');
                    }}
                  >
                    취소
                  </Button>
                </>
              ) : (
                <>
                  <Badge variant="outline">● 활성</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-7 gap-1 px-2 text-xs"
                    onClick={() => setPausingSource(source)}
                  >
                    <Pause className="h-3 w-3" /> 일시정지
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
