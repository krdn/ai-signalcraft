'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpcClient } from '@/lib/trpc';
import { useRunActionsModal } from '@/stores/run-actions-modal-store';
import type { StalledRun } from '@/server/trpc/routers/subscriptions';

type CollectorSource = 'naver-news' | 'youtube' | 'dcinside' | 'fmkorea' | 'clien';

const PUBLIC_SOURCES: CollectorSource[] = ['naver-news', 'youtube', 'dcinside', 'fmkorea', 'clien'];

function isPublicSource(source: string): source is CollectorSource {
  return (PUBLIC_SOURCES as readonly string[]).includes(source);
}

/**
 * 10분 이상 update 없는 running run을 감지해 상단 배너로 표시.
 * 자동 중지는 하지 않음 (false positive 위험) — 사용자 원클릭만 제공.
 * 'naver-comments' 같은 내부 소스는 개별 조작 대상 아니므로 강제 중지에서 제외.
 */
export function StalledRunsBanner() {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const qc = useQueryClient();
  const { openModal } = useRunActionsModal();

  const query = useQuery({
    queryKey: ['stalled-runs'],
    queryFn: () => trpcClient.subscriptions.stalled.query({ staleMinutes: 10 }),
    refetchInterval: 30_000,
  });

  const stalled = (query.data ?? []) as StalledRun[];

  const cancelAllMut = useMutation({
    mutationFn: async () => {
      // 공개 소스만 강제 중지 — naver-comments 등 내부 source는 skip
      const publicRuns = stalled.filter((r) => isPublicSource(r.source));
      for (const run of publicRuns) {
        await trpcClient.subscriptions.cancelRun.mutate({
          runId: run.runId,
          source: run.source as CollectorSource,
          mode: 'force',
        });
      }
      return { cancelled: publicRuns.length };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stalled-runs'] });
      qc.invalidateQueries({ queryKey: ['subscription-runs-monitor'] });
      setConfirming(false);
      setExpanded(false);
    },
  });

  if (stalled.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="text-sm font-medium">
          멈춘 것으로 의심되는 run {stalled.length}건 (10분 이상 업데이트 없음)
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <ChevronUp className="h-3 w-3 mr-1" />
            ) : (
              <ChevronDown className="h-3 w-3 mr-1" />
            )}
            {expanded ? '접기' : '모두 보기'}
          </Button>
          {!confirming ? (
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs"
              onClick={() => setConfirming(true)}
            >
              모두 중지 (force)
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs"
                disabled={cancelAllMut.isPending}
                onClick={() => cancelAllMut.mutate()}
              >
                {cancelAllMut.isPending
                  ? '처리 중...'
                  : `${stalled.filter((r) => isPublicSource(r.source)).length}건 확정 중지`}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setConfirming(false)}
              >
                취소
              </Button>
            </>
          )}
        </div>
      </div>
      {expanded && (
        <ul className="space-y-1 text-sm">
          {stalled.map((r) => (
            <li key={`${r.runId}-${r.source}`} className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs opacity-70">{r.runId.slice(0, 8)}</span>
              <span className="text-xs">{r.source}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(r.time).toLocaleTimeString('ko-KR')}
              </span>
              <span className="ml-auto flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs px-2"
                  onClick={() => openModal(r.runId, r.source, 'diagnose')}
                >
                  진단
                </Button>
                {isPublicSource(r.source) && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs px-2"
                      onClick={() => openModal(r.runId, r.source, 'cancel')}
                    >
                      중지
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-6 text-xs px-2"
                      onClick={() => openModal(r.runId, r.source, 'force-complete')}
                    >
                      DB 강제 완료
                    </Button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
