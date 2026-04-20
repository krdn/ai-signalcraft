'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

type RefKind = 'subscription' | 'run' | 'source' | 'analysis' | 'monitor';

interface CopyableClaudeRefProps {
  kind: RefKind;
  subscriptionId?: number;
  keyword?: string;
  runId?: string;
  source?: string;
  analysisId?: string | number;
  // run/source 태그에 추가 맥락 주석을 덧붙이고 싶을 때.
  // true면 keyword/source 중 없는 축을 `[...]`로 붙인다.
  withContext?: boolean;
  size?: 'xs' | 'sm';
  variant?: 'badge' | 'inline';
  // 표시용으로만 쓰는 짧은 라벨. 복사되는 값은 항상 전체 ref.
  displayLabel?: string;
  className?: string;
}

// Claude에게 맥락을 전달하기 위한 리소스 참조 태그.
// 형식:
//   @ais:sub/<id>[#label]
//   @ais:sub/<id>/run/<runId>[?source=<name>&keyword=<kw>]
//   @ais:sub/<id>/source/<name>[?keyword=<kw>]
//   @ais:sub/<id>/analysis/<id>
//   @ais:monitor
export function buildClaudeRef(
  props: Omit<CopyableClaudeRefProps, 'size' | 'variant' | 'className' | 'displayLabel'>,
): string {
  const { kind, subscriptionId, keyword, runId, source, analysisId, withContext } = props;
  if (kind === 'monitor') return `@ais:monitor`;
  const base = `@ais:sub/${subscriptionId ?? ''}`;
  const qs: string[] = [];
  if (withContext && keyword && kind !== 'subscription') {
    qs.push(`keyword=${encodeURIComponent(keyword)}`);
  }
  const suffix = qs.length > 0 ? `?${qs.join('&')}` : '';
  switch (kind) {
    case 'subscription':
      return keyword ? `${base}#${keyword}` : base;
    case 'run': {
      const src = source ? `&source=${source}` : '';
      return `${base}/run/${runId ?? ''}${suffix}${src}`;
    }
    case 'source':
      return `${base}/source/${source ?? ''}${suffix}`;
    case 'analysis':
      return `${base}/analysis/${analysisId ?? ''}${suffix}`;
  }
}

export function CopyableClaudeRef(props: CopyableClaudeRefProps) {
  const { size = 'xs', variant = 'badge', displayLabel, className } = props;
  const [copied, setCopied] = useState(false);
  const ref = buildClaudeRef(props);
  const shown = displayLabel ?? ref;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(ref);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // 클립보드 접근 실패 시 조용히 무시
    }
  };

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-3 w-3';
  const textSize = size === 'sm' ? 'text-xs' : 'text-[10px]';

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={handleCopy}
        title={`Claude 참조 복사: ${ref}`}
        className={cn(
          'group inline-flex items-center gap-1 rounded px-1 py-0.5 font-mono text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
          textSize,
          className,
        )}
      >
        <span className="tabular-nums">{shown}</span>
        {copied ? (
          <Check className={cn(iconSize, 'text-emerald-500')} />
        ) : (
          <Copy className={cn(iconSize, 'opacity-0 group-hover:opacity-100 transition-opacity')} />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Claude 참조 복사: ${ref}`}
      className={cn(
        'group inline-flex items-center gap-1 rounded border border-dashed border-muted-foreground/30 bg-muted/40 px-1.5 py-0.5 font-mono text-muted-foreground hover:border-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors',
        textSize,
        className,
      )}
    >
      <span className="tabular-nums">{shown}</span>
      {copied ? (
        <Check className={cn(iconSize, 'text-emerald-500')} />
      ) : (
        <Copy className={cn(iconSize, 'opacity-50 group-hover:opacity-100 transition-opacity')} />
      )}
    </button>
  );
}
