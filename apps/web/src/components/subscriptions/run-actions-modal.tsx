'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { RunProgressInline } from './run-progress-inline';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { trpcClient } from '@/lib/trpc';
import { useRunActionsModal } from '@/stores/run-actions-modal-store';

/**
 * RunActionsModal — 3개 탭(진단/중지/재시도)을 가진 전역 모달.
 * Zustand로 어디서든 openModal(runId, source, tab) 호출로 열기 가능.
 */
export function RunActionsModal() {
  const { open, runId, source, tab, closeModal, setTab } = useRunActionsModal();
  const queryClient = useQueryClient();
  const [forceMode, setForceMode] = useState(false);

  // 진단 — Layer A는 즉시, B/C는 polling으로 채워짐
  const diagQuery = useQuery({
    queryKey: ['run-diagnose', runId, source],
    queryFn: () =>
      trpcClient.subscriptions.diagnose.query({
        runId: runId!,
        source: (source ?? undefined) as
          | 'naver-news'
          | 'youtube'
          | 'dcinside'
          | 'fmkorea'
          | 'clien'
          | undefined,
      }),
    enabled: open && !!runId,
    refetchInterval: (query) => {
      const d = query.state.data as { layerB: unknown; layerC: unknown } | null | undefined;
      if (!d) return 5000;
      return d.layerB && d.layerC ? false : 5000;
    },
  });

  const cancelMut = useMutation({
    mutationFn: (mode: 'graceful' | 'force') =>
      trpcClient.subscriptions.cancelRun.mutate({
        runId: runId!,
        source: source as 'naver-news' | 'youtube' | 'dcinside' | 'fmkorea' | 'clien',
        mode,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-runs-monitor'] });
      queryClient.invalidateQueries({ queryKey: ['run-diagnose', runId, source] });
      closeModal();
    },
  });

  const retryMut = useMutation({
    mutationFn: () =>
      trpcClient.subscriptions.retry.mutate({
        runId: runId!,
        source: source as 'naver-news' | 'youtube' | 'dcinside' | 'fmkorea' | 'clien',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-runs-monitor'] });
      closeModal();
    },
  });

  if (!runId || !source) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) closeModal();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Run 액션
            <Badge variant="outline">{source}</Badge>
          </DialogTitle>
          <div className="text-xs text-muted-foreground font-mono break-all">{runId}</div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as RunActionsTabValue)}>
          <TabsList>
            <TabsTrigger value="diagnose">진단</TabsTrigger>
            <TabsTrigger value="cancel">중지</TabsTrigger>
            <TabsTrigger value="retry">재시도</TabsTrigger>
          </TabsList>

          <TabsContent value="diagnose" className="space-y-3 mt-4">
            {source && (
              <RunProgressInline
                runId={runId}
                source={source}
                active={isRunActive(diagQuery.data as DiagData | null | undefined)}
                variant="full"
              />
            )}
            {diagQuery.isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> 불러오는 중...
              </div>
            )}
            {diagQuery.data && (
              <>
                <LayerASection layerA={(diagQuery.data as DiagData).layerA} />
                <LayerBSection layerB={(diagQuery.data as DiagData).layerB} />
                <LayerCSection layerC={(diagQuery.data as DiagData).layerC} />
              </>
            )}
            {diagQuery.data === null && (
              <div className="text-sm text-muted-foreground space-y-2">
                <p>아직 생성된 진단 리포트가 없습니다.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await trpcClient.subscriptions.diagnose.query({
                      runId: runId!,
                      source: source as 'naver-news' | 'youtube' | 'dcinside' | 'fmkorea' | 'clien',
                      refresh: true,
                    });
                    diagQuery.refetch();
                  }}
                >
                  지금 수집
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="cancel" className="space-y-4 mt-4">
            <p className="text-sm">
              기본은 <strong>graceful</strong> 중지 — 현재 단계가 끝난 후 중단됩니다. 대부분의 경우
              이걸로 충분합니다.
            </p>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={forceMode} onCheckedChange={(v) => setForceMode(!!v)} />
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span>강제 중지 — active job 즉시 실패 처리. 부분 수집된 데이터는 남습니다.</span>
            </label>
            <Button
              variant={forceMode ? 'destructive' : 'default'}
              disabled={cancelMut.isPending}
              onClick={() => cancelMut.mutate(forceMode ? 'force' : 'graceful')}
            >
              {cancelMut.isPending ? '처리 중...' : forceMode ? '강제 중지' : '중지'}
            </Button>
          </TabsContent>

          <TabsContent value="retry" className="space-y-4 mt-4">
            <p className="text-sm">
              원본 파라미터로 새 run을 시작합니다. 체인 3회 초과 시 거부됩니다.
            </p>
            <Button disabled={retryMut.isPending} onClick={() => retryMut.mutate()}>
              {retryMut.isPending ? '재시도 중...' : '재시도'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

type RunActionsTabValue = 'diagnose' | 'cancel' | 'retry';

type DiagData = {
  layerA: LayerA | null;
  layerB: LayerB | null;
  layerC: LayerC | null;
};

/**
 * 진단 payload에서 현재 run이 "실시간 폴링 대상"인지 판단.
 * layerA가 아직 없으면 (최초 로드) 보수적으로 active 간주해 progress 스피너를 띄움.
 */
function isRunActive(data: DiagData | null | undefined): boolean {
  if (!data) return true;
  const state = data.layerA?.bullState;
  return state === 'active' || state === 'waiting' || state === 'delayed';
}

type LayerA = {
  bullState: string;
  attemptsMade: number;
  attemptsMax: number;
  partialRawItemsCount: number;
  partialRawItemsByType: { article: number; video: number; comment: number };
  failedReason: string | null;
  lastFetchError: string | null;
};

type LayerB = {
  source: string;
  last24h: {
    total: number;
    completed: number;
    failed: number;
    blocked: number;
    failRate: number;
  };
  consecutiveFailures: number;
  rateLimitHits: number;
  selectorChangeSuspected: boolean;
};

type LayerC = {
  redis: { ping: string; latencyMs: number };
  db: { ping: string; latencyMs: number };
  processMemMB: number;
  queues: Record<
    string,
    {
      workerCount: number;
      counts: { waiting: number; active: number; delayed: number; failed: number };
    }
  >;
};

function LayerASection({ layerA }: { layerA: LayerA | null }) {
  if (!layerA) return null;
  return (
    <section className="border rounded p-3 text-sm space-y-1">
      <h4 className="font-semibold">Layer A — Run 상태</h4>
      <div>
        BullMQ: <Badge variant="outline">{layerA.bullState}</Badge> · attempts {layerA.attemptsMade}
        /{layerA.attemptsMax}
      </div>
      <div>
        부분 수집: {layerA.partialRawItemsCount} (기사 {layerA.partialRawItemsByType.article} · 영상{' '}
        {layerA.partialRawItemsByType.video} · 댓글 {layerA.partialRawItemsByType.comment})
      </div>
      {layerA.failedReason && (
        <div className="text-red-600 break-all">최근 에러: {layerA.failedReason}</div>
      )}
      {layerA.lastFetchError && (
        <div className="text-amber-600 break-all">마지막 fetch error: {layerA.lastFetchError}</div>
      )}
    </section>
  );
}

function LayerBSection({ layerB }: { layerB: LayerB | null }) {
  if (!layerB) return <SkeletonBlock label="Layer B — 소스 건강도 수집 중..." />;
  const failCount = layerB.last24h.failed + layerB.last24h.blocked;
  const pct = Math.round(layerB.last24h.failRate * 100);
  return (
    <section className="border rounded p-3 text-sm space-y-1">
      <h4 className="font-semibold">Layer B — {layerB.source} 건강도 (24h)</h4>
      <div>
        총 {layerB.last24h.total} / 성공 {layerB.last24h.completed} / 실패 {failCount} ({pct}%)
      </div>
      <div>
        연속 실패 {layerB.consecutiveFailures} · rate limit {layerB.rateLimitHits}회
      </div>
      {layerB.selectorChangeSuspected && <div className="text-amber-600">⚠ 셀렉터 변경 의심</div>}
    </section>
  );
}

function LayerCSection({ layerC }: { layerC: LayerC | null }) {
  if (!layerC) return <SkeletonBlock label="Layer C — 시스템 상태 수집 중..." />;
  return (
    <section className="border rounded p-3 text-sm space-y-1">
      <h4 className="font-semibold">Layer C — 시스템</h4>
      <div>
        Redis {layerC.redis.ping} ({layerC.redis.latencyMs}ms) · DB {layerC.db.ping} (
        {layerC.db.latencyMs}ms) · mem {layerC.processMemMB}MB
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
        {Object.entries(layerC.queues).map(([name, q]) => (
          <div key={name}>
            {name}: w{q.workerCount} · a{q.counts.active} · w{q.counts.waiting} · f{q.counts.failed}
          </div>
        ))}
      </div>
    </section>
  );
}

function SkeletonBlock({ label }: { label: string }) {
  return (
    <section className="border rounded p-3 text-sm text-muted-foreground flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </section>
  );
}
