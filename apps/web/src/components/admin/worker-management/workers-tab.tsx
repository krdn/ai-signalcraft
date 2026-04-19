'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type { QueueHealth } from '@ai-signalcraft/core/client';
import { Button } from '@/components/ui/button';

const HEALTH_DOT: Record<string, string> = {
  healthy: 'bg-green-500',
  idle: 'bg-zinc-400',
  stuck: 'bg-amber-500',
  warn: 'bg-amber-500',
  down: 'bg-red-500',
};

interface WorkersTabProps {
  workerHealth: QueueHealth[];
}

const RESTART_COMMAND = 'dserver restart ais-prod-worker';

export function WorkersTab({ workerHealth }: WorkersTabProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(RESTART_COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-3 gap-3">
        {workerHealth.map((q) => (
          <div key={q.queue} className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${HEALTH_DOT[q.health]}`} />
              <span className="text-sm font-medium">{q.queue}</span>
            </div>

            <div className="mb-2 text-xs text-muted-foreground">워커 {q.workerCount}개 활성</div>

            {q.workers.length > 0 ? (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {q.workers.map((w) => (
                  <li key={w.id || w.addr}>
                    &bull; {w.addr || w.id} — idle {Math.floor(w.idle / 1000)}s
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-red-600">활성 워커 없음</p>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-muted p-3">
        <div className="mb-1.5 text-xs text-muted-foreground">워커 다운 시 재시작:</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded bg-background px-3 py-1.5 font-mono text-xs">
            {RESTART_COMMAND}
          </code>
          <Button variant="outline" size="sm" className="shrink-0 text-xs" onClick={handleCopy}>
            {copied ? (
              <Check className="mr-1 h-3 w-3 text-green-600" />
            ) : (
              <Copy className="mr-1 h-3 w-3" />
            )}
            {copied ? '복사됨' : '복사'}
          </Button>
        </div>
      </div>
    </div>
  );
}
