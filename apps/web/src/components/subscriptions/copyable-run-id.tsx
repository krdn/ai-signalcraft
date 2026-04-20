'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CopyableRunIdProps {
  runId: string;
}

export function CopyableRunId({ runId }: CopyableRunIdProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(runId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // 클립보드 접근 실패 시 조용히 무시
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`클릭하여 전체 runId 복사: ${runId}`}
      className="group inline-flex items-center gap-1 rounded px-1 py-0.5 font-mono text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    >
      <span className="tabular-nums">{runId.slice(0, 8)}</span>
      {copied ? (
        <Check className="h-3 w-3 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  );
}
