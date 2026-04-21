'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc';
import type { RunProgress } from '@/server/trpc/routers/subscriptions';

// web proxy에 등록된 소스 enum과 맞춤. naver-comments는 독립 run UI에서 쓰지 않음.
type ProxySource = 'naver-news' | 'youtube' | 'dcinside' | 'fmkorea' | 'clien';
const PROXY_SOURCES: ProxySource[] = ['naver-news', 'youtube', 'dcinside', 'fmkorea', 'clien'];

const POLL_MS = 2000;
const STALE_MS = 1000;

interface RunProgressInlineProps {
  runId: string;
  source: string;
  /** 'running'일 때만 폴링 활성. 다른 상태면 refetch 중단으로 네트워크 절약. */
  active: boolean;
  /** 'compact' (LiveRunFeed row) | 'full' (modal 상단) */
  variant?: 'compact' | 'full';
}

/**
 * 현재 실행 중인 수집 run의 실시간 진행 상태를 표시한다.
 *
 * - 2초 폴링 (TanStack Query). 동일 (runId, source)은 queryKey 공유로 중복 요청 제거
 * - lastProgressAtMs → Date.now()로 heartbeat age 계산. 1초 간격 client setInterval
 * - 30s+ 무응답이면 "응답 없음" 경고. 실제 stalled 판정은 서버(StalledRunsBanner)가 담당
 */
export function RunProgressInline({
  runId,
  source,
  active,
  variant = 'compact',
}: RunProgressInlineProps) {
  // naver-comments 등 proxy enum에 없는 소스는 폴링 대상에서 제외 (서버에서 enum 검증 실패로 500 방지).
  const isPollable = (PROXY_SOURCES as readonly string[]).includes(source);
  const query = useQuery({
    queryKey: ['run-progress', runId, source],
    queryFn: () =>
      trpcClient.subscriptions.runProgress.query({
        runId,
        source: source as ProxySource,
      }),
    enabled: isPollable,
    refetchInterval: active && isPollable ? POLL_MS : false,
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });

  // 서버에서 받은 lastProgressAtMs가 바뀌어도 UI age는 클라 틱으로 계속 증가해야
  // "2초마다 갱신되는 숫자"가 끊기지 않는다.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  const data = query.data as RunProgress | undefined;
  if (!data) {
    // 첫 로드 전엔 조용히 skeleton. row 레이아웃 안 깨지게 고정폭 사용
    return variant === 'compact' ? (
      <span className="text-xs text-muted-foreground tabular-nums opacity-60">수집…</span>
    ) : null;
  }

  const { byType, itemsCollected, lastProgressAtMs } = data;
  const ageMs = lastProgressAtMs ? now - lastProgressAtMs : null;
  const heartbeat = classifyHeartbeat(ageMs, active);

  const summary = buildSummary(byType, itemsCollected, source);

  if (variant === 'full') {
    return (
      <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
        <HeartbeatDot kind={heartbeat.kind} />
        <div className="flex-1 min-w-0">
          <div className="font-medium tabular-nums">{summary}</div>
          <div className={`text-xs ${heartbeat.textClass}`}>{heartbeat.label}</div>
        </div>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs tabular-nums">
      <HeartbeatDot kind={heartbeat.kind} />
      <span className="text-foreground/90">{summary}</span>
      <span className={`${heartbeat.textClass}`}>· {heartbeat.label}</span>
    </span>
  );
}

/**
 * article + comment 중심. video는 YouTube 구독에서만 의미.
 *
 * byType은 fetched_from_run 기준 — 이 run이 DB에 실제로 적재한 "신규" 건수.
 * itemsCollected는 어댑터가 수집을 시도한 총 건수. 둘의 차이 = UNIQUE 충돌로 스킵된 중복.
 * 중복이 있을 때만 "수집 N · 중복 M" 병기로 사용자에게 스킵 사실을 노출한다.
 */
function buildSummary(
  byType: { article: number; video: number; comment: number },
  itemsCollected: number,
  source: string,
): string {
  const newTotal = byType.article + byType.video + byType.comment;
  const dup = Math.max(0, itemsCollected - newTotal);
  const dupSuffix = dup > 0 ? ` (수집 ${itemsCollected} · 중복 ${dup})` : '';

  if (source === 'youtube') {
    return `신규 영상 ${byType.video} · 댓글 ${byType.comment}${dupSuffix}`;
  }
  if (source === 'naver-comments') {
    return `신규 댓글 ${byType.comment}${dupSuffix}`;
  }
  return `신규 기사 ${byType.article} · 댓글 ${byType.comment}${dupSuffix}`;
}

type HeartbeatKind = 'live' | 'idle' | 'slow' | 'stalled' | 'inactive';

function classifyHeartbeat(
  ageMs: number | null,
  active: boolean,
): { kind: HeartbeatKind; label: string; textClass: string } {
  if (!active) {
    return { kind: 'inactive', label: '종료됨', textClass: 'text-muted-foreground' };
  }
  if (ageMs == null) {
    return { kind: 'idle', label: '대기 중', textClass: 'text-muted-foreground' };
  }
  const sec = Math.floor(ageMs / 1000);
  if (sec < 10) {
    return { kind: 'live', label: '방금 전', textClass: 'text-muted-foreground' };
  }
  if (sec < 30) {
    return { kind: 'idle', label: `${sec}초 전`, textClass: 'text-muted-foreground' };
  }
  if (sec < 60) {
    return { kind: 'slow', label: `응답 없음 ${sec}s`, textClass: 'text-yellow-600' };
  }
  const min = Math.floor(sec / 60);
  return { kind: 'stalled', label: `응답 없음 ${min}분`, textClass: 'text-red-600' };
}

function HeartbeatDot({ kind }: { kind: HeartbeatKind }) {
  if (kind === 'live') {
    return (
      <span className="relative inline-flex h-2 w-2 shrink-0" aria-label="수집 진행 중">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
    );
  }
  const color =
    kind === 'slow'
      ? 'bg-yellow-500'
      : kind === 'stalled'
        ? 'bg-red-500'
        : kind === 'inactive'
          ? 'bg-muted-foreground/40'
          : 'bg-muted-foreground/60';
  return <span className={`inline-flex h-2 w-2 shrink-0 rounded-full ${color}`} aria-hidden />;
}
