'use client';

import { Pause, Play, Trash2, Zap, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  SOURCE_LABEL_MAP,
  getStatusLabel,
  getStatusVariant,
  formatRelative,
} from './subscription-utils';
import { CopyableClaudeRef } from './copyable-claude-ref';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSubscriptionActions } from '@/hooks/use-subscription-actions';
import type { SubscriptionRecord } from '@/server/trpc/routers/subscriptions';

interface SubscriptionHeaderProps {
  subscription: SubscriptionRecord;
  onEdit: () => void;
}

export function SubscriptionHeader({ subscription: sub, onEdit }: SubscriptionHeaderProps) {
  const router = useRouter();
  const { pause, resume, remove, triggerNow } = useSubscriptionActions();

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur pb-3 border-b mb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">{sub.keyword}</h1>
            <Badge variant={getStatusVariant(sub.status)} className="text-xs">
              {getStatusLabel(sub.status)}
            </Badge>
            <CopyableClaudeRef
              kind="subscription"
              subscriptionId={sub.id}
              keyword={sub.keyword}
              size="sm"
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span>{sub.intervalHours}시간 주기</span>
            <span>
              {(sub.sources as string[]).map((s) => SOURCE_LABEL_MAP[s] ?? s).join(' · ')}
            </span>
            <span>실행당 {sub.limits.maxPerRun}건</span>
            {sub.limits.commentsPerItem != null && (
              <span>댓글 {sub.limits.commentsPerItem}개/항목</span>
            )}
            {sub.options?.collectTranscript && <span>자막 수집 ON</span>}
            <span>생성: {formatRelative(sub.createdAt)}</span>
          </div>
          {sub.lastError && (
            <p className="text-xs text-destructive truncate max-w-md">오류: {sub.lastError}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1" />
            편집
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerNow.mutate(sub.id)}
            disabled={triggerNow.isPending || sub.status === 'paused'}
          >
            <Zap className="h-3.5 w-3.5 mr-1" />
            즉시 수집
          </Button>
          {sub.status === 'active' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => pause.mutate(sub.id)}
              disabled={pause.isPending}
            >
              <Pause className="h-3.5 w-3.5 mr-1" />
              정지
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => resume.mutate(sub.id)}
              disabled={resume.isPending}
            >
              <Play className="h-3.5 w-3.5 mr-1" />
              재개
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm(`"${sub.keyword}" 구독을 삭제하시겠습니까?`)) {
                remove.mutate(sub.id, { onSuccess: () => router.push('/subscriptions') });
              }
            }}
            disabled={remove.isPending}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}
