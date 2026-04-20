'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Pause,
  Play,
  Trash2,
  Zap,
  BarChart3,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronRight,
} from 'lucide-react';
import {
  formatRelative,
  SOURCE_LABEL_MAP,
  getStatusLabel,
  getStatusVariant,
} from './subscription-utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSubscriptionActions } from '@/hooks/use-subscription-actions';
import type {
  SubscriptionRecord,
  RunRecord,
  RunItemBreakdownEntry,
} from '@/server/trpc/routers/subscriptions';

interface SubscriptionTableProps {
  subscriptions: SubscriptionRecord[];
  runs: RunRecord[];
  breakdown?: RunItemBreakdownEntry[];
  statusFilter: string;
}

type SourceBreakdown = {
  source: string;
  article: number;
  video: number;
  comment: number;
  total: number;
};

type SortKey = 'keyword' | 'status' | 'collected' | 'successRate' | 'lastRunAt' | 'nextRunAt';

export function SubscriptionTable({
  subscriptions,
  runs,
  breakdown,
  statusFilter,
}: SubscriptionTableProps) {
  const router = useRouter();
  const { pause, resume, remove, triggerNow } = useSubscriptionActions();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('keyword');
  const [sortAsc, setSortAsc] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const now = Date.now();
  const h24Ago = now - 24 * 3600 * 1000;

  const runsBySubId = useMemo(() => {
    const map = new Map<number, RunRecord[]>();
    for (const r of runs) {
      if (new Date(r.time).getTime() < h24Ago) continue;
      const arr = map.get(r.subscriptionId) ?? [];
      arr.push(r);
      map.set(r.subscriptionId, arr);
    }
    return map;
  }, [runs, h24Ago]);

  // runId → subscriptionId 역인덱스(24h 윈도우). breakdown은 runId 기준이라
  // 구독별로 재집계하려면 이 맵이 필요.
  const runIdToSubId = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of runs) {
      if (new Date(r.time).getTime() < h24Ago) continue;
      map.set(r.runId, r.subscriptionId);
    }
    return map;
  }, [runs, h24Ago]);

  // subscriptionId → source → {article, video, comment, total}
  const breakdownBySubId = useMemo(() => {
    const map = new Map<number, Map<string, SourceBreakdown>>();
    if (!breakdown) return map;
    for (const b of breakdown) {
      if (!b.fetchedFromRun) continue;
      const subId = runIdToSubId.get(b.fetchedFromRun);
      if (subId === undefined) continue;
      let sourceMap = map.get(subId);
      if (!sourceMap) {
        sourceMap = new Map();
        map.set(subId, sourceMap);
      }
      let entry = sourceMap.get(b.source);
      if (!entry) {
        entry = { source: b.source, article: 0, video: 0, comment: 0, total: 0 };
        sourceMap.set(b.source, entry);
      }
      if (b.itemType === 'article') entry.article += b.count;
      else if (b.itemType === 'video') entry.video += b.count;
      else if (b.itemType === 'comment') entry.comment += b.count;
      entry.total += b.count;
    }
    return map;
  }, [breakdown, runIdToSubId]);

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const enriched = useMemo(() => {
    return subscriptions.map((sub) => {
      const subRuns = runsBySubId.get(sub.id) ?? [];
      const collected = subRuns.reduce((s, r) => s + (r.itemsCollected ?? 0), 0);
      const completed = subRuns.filter((r) => r.status === 'completed').length;
      const successRate = subRuns.length > 0 ? (completed / subRuns.length) * 100 : -1;
      return { ...sub, collected24h: collected, successRate24h: successRate };
    });
  }, [subscriptions, runsBySubId]);

  const filtered = useMemo(() => {
    let rows = enriched;
    if (statusFilter !== 'all') {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.keyword.toLowerCase().includes(q));
    }
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'keyword':
          cmp = a.keyword.localeCompare(b.keyword, 'ko');
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'collected':
          cmp = a.collected24h - b.collected24h;
          break;
        case 'successRate':
          cmp = a.successRate24h - b.successRate24h;
          break;
        case 'lastRunAt':
          cmp =
            (a.lastRunAt ? new Date(a.lastRunAt).getTime() : 0) -
            (b.lastRunAt ? new Date(b.lastRunAt).getTime() : 0);
          break;
        case 'nextRunAt':
          cmp =
            (a.nextRunAt ? new Date(a.nextRunAt).getTime() : Infinity) -
            (b.nextRunAt ? new Date(b.nextRunAt).getTime() : Infinity);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return rows;
  }, [enriched, statusFilter, search, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortAsc ? (
      <ChevronUp className="h-3 w-3 inline ml-0.5" />
    ) : (
      <ChevronDown className="h-3 w-3 inline ml-0.5" />
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="키워드 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length}개</span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[32px]" />
              <TableHead className="cursor-pointer" onClick={() => toggleSort('keyword')}>
                키워드 <SortIcon col="keyword" />
              </TableHead>
              <TableHead className="cursor-pointer w-[70px]" onClick={() => toggleSort('status')}>
                상태 <SortIcon col="status" />
              </TableHead>
              <TableHead className="hidden lg:table-cell">소스</TableHead>
              <TableHead className="hidden md:table-cell w-[60px]">주기</TableHead>
              <TableHead
                className="cursor-pointer text-right w-[80px]"
                onClick={() => toggleSort('collected')}
              >
                수집(24h) <SortIcon col="collected" />
              </TableHead>
              <TableHead
                className="cursor-pointer text-right hidden md:table-cell w-[80px]"
                onClick={() => toggleSort('successRate')}
              >
                성공률 <SortIcon col="successRate" />
              </TableHead>
              <TableHead
                className="cursor-pointer hidden lg:table-cell"
                onClick={() => toggleSort('lastRunAt')}
              >
                마지막 실행 <SortIcon col="lastRunAt" />
              </TableHead>
              <TableHead
                className="cursor-pointer hidden lg:table-cell"
                onClick={() => toggleSort('nextRunAt')}
              >
                다음 예정 <SortIcon col="nextRunAt" />
              </TableHead>
              <TableHead className="w-[120px]">액션</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-sm text-muted-foreground">
                  {search ? '검색 결과가 없습니다' : '등록된 구독이 없습니다'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.flatMap((row) => {
                const isOpen = expanded.has(row.id);
                const sourceMap = breakdownBySubId.get(row.id);
                const sourceRows: SourceBreakdown[] = (row.sources as string[]).map((s) => {
                  return (
                    sourceMap?.get(s) ?? {
                      source: s,
                      article: 0,
                      video: 0,
                      comment: 0,
                      total: 0,
                    }
                  );
                });
                const mainRow = (
                  <TableRow
                    key={row.id}
                    className={`cursor-pointer ${row.status === 'error' ? 'bg-destructive/5' : ''}`}
                    onClick={() => router.push(`/subscriptions/${row.id}`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => toggleExpand(row.id)}
                        title={isOpen ? '접기' : '소스별 상세'}
                      >
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{row.keyword}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(row.status)} className="text-[10px]">
                        {getStatusLabel(row.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex gap-1 flex-wrap">
                        {(row.sources as string[]).map((s) => (
                          <Badge key={s} variant="outline" className="text-[9px] font-normal">
                            {SOURCE_LABEL_MAP[s] ?? s}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {row.intervalHours}h
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {row.collected24h.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell text-sm tabular-nums">
                      {row.successRate24h >= 0 ? `${row.successRate24h.toFixed(0)}%` : '-'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {formatRelative(row.lastRunAt)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {formatRelative(row.nextRunAt)}
                    </TableCell>
                    <TableCell>
                      <div
                        className="flex items-center gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            router.push(`/dashboard?keyword=${encodeURIComponent(row.keyword)}`)
                          }
                          title="분석"
                        >
                          <BarChart3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => triggerNow.mutate(row.id)}
                          disabled={triggerNow.isPending || row.status === 'paused'}
                          title="즉시 수집"
                        >
                          <Zap className="h-3.5 w-3.5" />
                        </Button>
                        {row.status === 'active' ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => pause.mutate(row.id)}
                            disabled={pause.isPending}
                            title="정지"
                          >
                            <Pause className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => resume.mutate(row.id)}
                            disabled={resume.isPending}
                            title="재개"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            if (confirm(`"${row.keyword}" 구독을 삭제하시겠습니까?`)) {
                              remove.mutate(row.id);
                            }
                          }}
                          disabled={remove.isPending}
                          title="삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );

                const expandRow = isOpen ? (
                  <TableRow key={`${row.id}-expand`} className="bg-muted/30 hover:bg-muted/30">
                    <TableCell />
                    <TableCell colSpan={9} className="py-2">
                      <div className="flex flex-wrap gap-2">
                        {sourceRows.length === 0 ? (
                          <span className="text-xs text-muted-foreground">등록된 소스 없음</span>
                        ) : (
                          sourceRows.map((sb) => (
                            <div
                              key={sb.source}
                              className="min-w-[140px] rounded-md border bg-background px-2.5 py-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium">
                                  {SOURCE_LABEL_MAP[sb.source] ?? sb.source}
                                </span>
                                <span className="text-xs tabular-nums text-muted-foreground">
                                  {sb.total.toLocaleString()}
                                </span>
                              </div>
                              <div className="mt-0.5 flex gap-2 text-[10px] text-muted-foreground tabular-nums">
                                {sb.article > 0 && <span>기사 {sb.article.toLocaleString()}</span>}
                                {sb.video > 0 && <span>영상 {sb.video.toLocaleString()}</span>}
                                {sb.comment > 0 && <span>댓글 {sb.comment.toLocaleString()}</span>}
                                {sb.total === 0 && <span>24h 수집 없음</span>}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null;

                return expandRow ? [mainRow, expandRow] : [mainRow];
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
