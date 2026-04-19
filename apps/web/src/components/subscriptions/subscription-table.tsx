'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Pause, Play, Trash2, Zap, BarChart3, Search, ChevronDown, ChevronUp } from 'lucide-react';
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
import type { SubscriptionRecord, RunRecord } from '@/server/trpc/routers/subscriptions';

interface SubscriptionTableProps {
  subscriptions: SubscriptionRecord[];
  runs: RunRecord[];
  statusFilter: string;
}

type SortKey = 'keyword' | 'status' | 'collected' | 'successRate' | 'lastRunAt' | 'nextRunAt';

export function SubscriptionTable({ subscriptions, runs, statusFilter }: SubscriptionTableProps) {
  const router = useRouter();
  const { pause, resume, remove, triggerNow } = useSubscriptionActions();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('keyword');
  const [sortAsc, setSortAsc] = useState(true);

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
                <TableCell colSpan={9} className="text-center py-8 text-sm text-muted-foreground">
                  {search ? '검색 결과가 없습니다' : '등록된 구독이 없습니다'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow
                  key={row.id}
                  className={`cursor-pointer ${row.status === 'error' ? 'bg-destructive/5' : ''}`}
                  onClick={() => router.push(`/subscriptions/${row.id}`)}
                >
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
                    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
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
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
