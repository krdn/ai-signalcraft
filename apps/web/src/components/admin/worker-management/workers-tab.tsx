'use client';

import { useState } from 'react';
import { Copy, Check, AlertTriangle, Terminal } from 'lucide-react';
import type { QueueHealth } from '@ai-signalcraft/core/client';
import { Button } from '@/components/ui/button';

const HEALTH_DOT: Record<string, string> = {
  healthy: 'bg-green-500',
  idle: 'bg-zinc-400',
  stuck: 'bg-amber-500',
  warn: 'bg-amber-500',
  down: 'bg-red-500',
};

const STATUS_GUIDE: Record<
  string,
  { message: string; severity: 'error' | 'warning' | 'info'; command?: string }
> = {
  down: {
    message: '워커가 다운되었습니다. 즉시 재시작하세요.',
    severity: 'error',
    command: 'dserver restart ais-prod-worker',
  },
  stuck: {
    message: '대기 작업이 처리되지 않고 있습니다. 로그를 확인하세요.',
    severity: 'warning',
    command: 'dserver logs ais-prod-worker --tail 50',
  },
  warn: {
    message: '활성 워커가 응답하지 않습니다. 재시작을 고려하세요.',
    severity: 'warning',
    command: 'dserver restart ais-prod-worker',
  },
  healthy: { message: '정상 상태입니다.', severity: 'info' },
  idle: { message: '정상 상태입니다.', severity: 'info' },
};

const COMMANDS = [
  { label: '재시작', command: 'dserver restart ais-prod-worker' },
  { label: '로그 확인', command: 'dserver logs ais-prod-worker --tail 50' },
  { label: '강제 중지', command: 'dserver stop ais-prod-worker' },
];

interface WorkersTabProps {
  workerHealth: QueueHealth[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={handleCopy}>
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

export function WorkersTab({ workerHealth }: WorkersTabProps) {
  const worstHealth = workerHealth.reduce((worst, q) => {
    const priority: Record<string, number> = { down: 4, stuck: 3, warn: 2, healthy: 1, idle: 0 };
    return (priority[q.health] ?? 0) > (priority[worst] ?? 0) ? q.health : worst;
  }, 'idle' as string);

  const guide = STATUS_GUIDE[worstHealth] ?? STATUS_GUIDE.idle;

  return (
    <div className="space-y-4 pt-4">
      {guide.severity !== 'info' && (
        <div
          className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
            guide.severity === 'error'
              ? 'border border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400'
              : 'border border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400'
          }`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">{guide.message}</div>
            {guide.command && (
              <div className="mt-1 flex items-center gap-2">
                <code className="rounded bg-background px-2 py-0.5 font-mono text-xs">
                  {guide.command}
                </code>
                <CopyButton text={guide.command} />
              </div>
            )}
          </div>
        </div>
      )}

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
        <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Terminal className="h-3 w-3" />
          명령어
        </div>
        <div className="space-y-1.5">
          {COMMANDS.map((cmd) => (
            <div key={cmd.label} className="flex items-center gap-2">
              <span className="w-16 text-xs text-muted-foreground">{cmd.label}</span>
              <code className="flex-1 rounded bg-background px-2 py-1 font-mono text-xs">
                {cmd.command}
              </code>
              <CopyButton text={cmd.command} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
