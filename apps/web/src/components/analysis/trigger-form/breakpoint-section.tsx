'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Bookmark } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const STAGES = [
  { value: 'collection', label: '수집 완료 후' },
  { value: 'normalize', label: '정규화 완료 후' },
  { value: 'token-optimization', label: '토큰 최적화 완료 후' },
  { value: 'item-analysis', label: '개별 감정 분석 완료 후' },
  { value: 'analysis-stage1', label: 'AI 분석 Stage 1 완료 후 (병렬 4모듈)' },
  { value: 'analysis-stage2', label: 'AI 분석 Stage 2 완료 후 (전략·최종요약)' },
  { value: 'analysis-stage4', label: 'AI 분석 Stage 4 완료 후 (고급 분석)' },
] as const;

export type BreakpointValue = (typeof STAGES)[number]['value'];

interface Props {
  value: BreakpointValue[];
  onChange: (next: BreakpointValue[]) => void;
}

export function BreakpointSection({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  function toggle(stage: BreakpointValue) {
    if (value.includes(stage)) {
      onChange(value.filter((s) => s !== stage));
    } else {
      onChange([...value, stage]);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
      >
        <span className="flex items-center gap-2">
          <Bookmark className="h-4 w-4" />
          단계별 검수 정지 (선택)
          {value.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              {value.length}개 설정됨
            </span>
          )}
        </span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && (
        <div className="space-y-2 border-t border-border px-4 py-3">
          {STAGES.map((stage) => (
            <div key={stage.value} className="flex items-center gap-2">
              <Checkbox
                id={`bp-${stage.value}`}
                checked={value.includes(stage.value)}
                onCheckedChange={() => toggle(stage.value)}
              />
              <Label htmlFor={`bp-${stage.value}`} className="cursor-pointer text-sm font-normal">
                {stage.label}
              </Label>
            </div>
          ))}
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            💡 체크한 단계가 끝나면 자동 정지되며, 검수 후 [다음 단계 실행] 버튼으로 재개합니다.
            24시간 내 재개하지 않으면 자동 취소됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
