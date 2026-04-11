'use client';

import { X } from 'lucide-react';
import type { QueueHealth } from '@ai-signalcraft/core/client';

interface Props {
  data: QueueHealth[];
  onClose: () => void;
}

export function WorkerHealthModal({ data, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">워커 헬스 상태</h2>
          <button onClick={onClose} aria-label="닫기">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {data.map((q) => (
            <div key={q.queue} className="rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium">
                  {q.queue} <span className="text-xs text-muted-foreground">({q.health})</span>
                </h3>
                <span className="text-xs text-muted-foreground">워커 {q.workerCount}개</span>
              </div>
              <div className="mb-2 grid grid-cols-5 gap-2 text-xs">
                <div>active: {q.counts.active}</div>
                <div>waiting: {q.counts.waiting}</div>
                <div>delayed: {q.counts.delayed}</div>
                <div>failed: {q.counts.failed}</div>
                <div>paused: {q.counts.paused}</div>
              </div>
              {q.workers.length > 0 ? (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {q.workers.map((w) => (
                    <li key={w.id || w.addr}>
                      {w.addr || w.id} · idle {Math.floor(w.idle / 1000)}s
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-red-600">⚠ 활성 워커 없음 — 프로세스 다운 의심</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-md bg-muted p-3 font-mono text-xs">
          # 워커 재시작 명령
          <br />
          dserver restart ais-prod-worker
        </div>
      </div>
    </div>
  );
}
