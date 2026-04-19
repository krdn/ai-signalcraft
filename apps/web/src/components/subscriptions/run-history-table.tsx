'use client';

import { SOURCE_LABEL_MAP, formatRelative } from './subscription-utils';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { RunRecord, RunItemBreakdownEntry } from '@/server/trpc/routers/subscriptions';

interface RunHistoryTableProps {
  runs: RunRecord[];
  breakdown?: RunItemBreakdownEntry[];
  limit?: number;
}

function getRunStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'completed':
      return 'default';
    case 'running':
      return 'secondary';
    case 'blocked':
      return 'outline';
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
}

function getRunStatusLabel(status: string): string {
  switch (status) {
    case 'completed':
      return '완료';
    case 'running':
      return '실행 중';
    case 'blocked':
      return '차단';
    case 'failed':
      return '실패';
    default:
      return status;
  }
}

const ITEM_TYPE_LABEL: Record<string, string> = {
  article: '기사',
  video: '영상',
  comment: '댓글',
};

function getBreakdownText(
  runId: string,
  source: string,
  breakdown?: RunItemBreakdownEntry[],
): string | null {
  if (!breakdown || breakdown.length === 0) return null;
  const entries = breakdown.filter((b) => b.fetchedFromRun === runId && b.source === source);
  if (entries.length === 0) return null;
  return entries.map((e) => `${ITEM_TYPE_LABEL[e.itemType] ?? e.itemType} ${e.count}`).join(' / ');
}

export function RunHistoryTable({ runs, breakdown, limit = 50 }: RunHistoryTableProps) {
  const sorted = [...runs]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, limit);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">실행 ID</TableHead>
            <TableHead>소스</TableHead>
            <TableHead>상태</TableHead>
            <TableHead className="text-right">수집</TableHead>
            <TableHead className="text-right">신규</TableHead>
            <TableHead className="text-right hidden md:table-cell">소요</TableHead>
            <TableHead className="hidden md:table-cell">트리거</TableHead>
            <TableHead>시간</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-6 text-sm text-muted-foreground">
                실행 기록이 없습니다
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((run, i) => {
              const prevRun = sorted[i - 1];
              const sameGroup = prevRun?.runId === run.runId;
              const bdText = getBreakdownText(run.runId, run.source, breakdown);
              return (
                <TableRow
                  key={`${run.runId}-${run.source}-${i}`}
                  className={
                    run.status === 'failed' || run.status === 'blocked' ? 'bg-destructive/5' : ''
                  }
                >
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {sameGroup ? '' : run.runId.slice(0, 7)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {SOURCE_LABEL_MAP[run.source] ?? run.source}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRunStatusVariant(run.status)} className="text-[10px]">
                      {getRunStatusLabel(run.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    <div>{run.itemsCollected}</div>
                    {bdText && (
                      <div className="text-[10px] text-muted-foreground font-normal">{bdText}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{run.itemsNew}</TableCell>
                  <TableCell className="text-right hidden md:table-cell text-xs tabular-nums">
                    {run.durationMs != null ? `${(run.durationMs / 1000).toFixed(1)}s` : '-'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {run.triggerType === 'schedule' ? '스케줄' : '수동'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatRelative(run.time)}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
