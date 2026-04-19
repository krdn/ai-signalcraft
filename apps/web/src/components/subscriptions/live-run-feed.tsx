'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { SOURCE_LABEL_MAP } from './subscription-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RunRecord } from '@/server/trpc/routers/subscriptions';

interface LiveRunFeedProps {
  runs: RunRecord[];
}

function ElapsedTimer({ since }: { since: Date }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(Math.floor((Date.now() - since.getTime()) / 1000));
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - since.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [since]);

  if (elapsed < 60) return <span>{elapsed}초</span>;
  return (
    <span>
      {Math.floor(elapsed / 60)}분 {elapsed % 60}초
    </span>
  );
}

export function LiveRunFeed({ runs }: LiveRunFeedProps) {
  const runningRuns = runs.filter((r) => r.status === 'running');

  if (runningRuns.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">실행 중인 작업</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">
            현재 실행 중인 수집 작업이 없습니다
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          실행 중인 작업
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
          <span className="text-xs font-normal text-muted-foreground">{runningRuns.length}건</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {runningRuns.map((run, i) => (
            <div
              key={`${run.runId}-${run.source}-${i}`}
              className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 shrink-0" />
              <span className="font-mono text-xs text-muted-foreground">
                {run.runId.slice(0, 7)}
              </span>
              <span className="font-medium">
                {run.source in SOURCE_LABEL_MAP ? '' : run.source}
              </span>
              <span className="text-muted-foreground">→</span>
              <span>{SOURCE_LABEL_MAP[run.source] ?? run.source}</span>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                <ElapsedTimer since={new Date(run.time)} />
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
