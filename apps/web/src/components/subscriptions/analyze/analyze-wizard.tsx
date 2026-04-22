'use client';

import { useState } from 'react';
import type { SubscriptionSummary } from '../../analysis/subscription-picker';

export type WizardStep = 'select' | 'config' | 'running' | 'result';

interface WizardState {
  step: WizardStep;
  subscription: SubscriptionSummary | null;
  jobId: number | null;
  keyword: string;
}

interface AnalyzeWizardProps {
  children: (state: WizardState, setState: (s: Partial<WizardState>) => void) => React.ReactNode;
}

const STEP_LABELS: Record<WizardStep, string> = {
  select: '구독 선택',
  config: '분석 설정',
  running: '실행 중',
  result: '결과',
};

const STEP_ORDER: WizardStep[] = ['select', 'config', 'running', 'result'];

export function AnalyzeWizard({ children }: AnalyzeWizardProps) {
  const [state, setStateRaw] = useState<WizardState>({
    step: 'select',
    subscription: null,
    jobId: null,
    keyword: '',
  });

  const setState = (partial: Partial<WizardState>) =>
    setStateRaw((prev) => ({ ...prev, ...partial }));

  const currentIdx = STEP_ORDER.indexOf(state.step);

  return (
    <div className="space-y-6">
      {/* 스텝퍼 */}
      <div className="flex items-center gap-2">
        {STEP_ORDER.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                i < currentIdx
                  ? 'bg-primary text-primary-foreground'
                  : i === currentIdx
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-sm ${i === currentIdx ? 'font-medium' : 'text-muted-foreground'}`}
            >
              {STEP_LABELS[s]}
            </span>
            {i < STEP_ORDER.length - 1 && (
              <div className={`h-0.5 w-8 ${i < currentIdx ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      {/* 단계 컨텐츠 */}
      {children(state, setState)}
    </div>
  );
}
