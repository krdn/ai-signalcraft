'use client';

import { RotateCcw, Search, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRunActionsModal } from '@/stores/run-actions-modal-store';

const TRIGGER_CLASS =
  'inline-flex items-center justify-center gap-1 rounded-md border border-input bg-background px-2 text-xs font-medium shadow-xs hover:bg-accent hover:text-accent-foreground h-7';

interface Props {
  runId: string;
  source: string;
  status: string;
}

/**
 * Run row 우측에 붙는 상태별 액션 버튼.
 * running → [중지 ▾] 드롭다운 (graceful / force / 진단)
 * failed/blocked → [재시도] [진단]
 * completed/기타 → [진단]만
 *
 * 실제 작업은 RunActionsModal (전역)에서 수행 — 여기는 모달 open 트리거만.
 */
export function RunRowActions({ runId, source, status }: Props) {
  const { openModal } = useRunActionsModal();

  if (status === 'running' || status === 'cancelling') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger className={TRIGGER_CLASS}>
          <Square className="h-3 w-3" /> 중지
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openModal(runId, source, 'cancel')}>
            Graceful 중지
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            onClick={() => openModal(runId, source, 'cancel')}
          >
            강제 중지
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openModal(runId, source, 'diagnose')}>
            진단 보기
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (status === 'failed' || status === 'blocked') {
    return (
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => openModal(runId, source, 'retry')}
        >
          <RotateCcw className="h-3 w-3" /> 재시도
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => openModal(runId, source, 'diagnose')}
          aria-label="진단"
        >
          <Search className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // completed / 기타
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 w-7 p-0 opacity-60 hover:opacity-100"
      onClick={() => openModal(runId, source, 'diagnose')}
      aria-label="진단"
    >
      <Search className="h-3 w-3" />
    </Button>
  );
}
