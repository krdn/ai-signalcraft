'use client';

import { useState } from 'react';
import { PresetSelector, type PresetData } from './preset-selector';
import { TriggerForm } from './trigger-form';

interface AnalysisLauncherProps {
  onJobStarted: (jobId: number) => void;
  isDemo?: boolean;
}

export function AnalysisLauncher({ onJobStarted, isDemo }: AnalysisLauncherProps) {
  const [selectedPreset, setSelectedPreset] = useState<PresetData | null>(null);
  const [step, setStep] = useState<'select' | 'configure'>('select');

  // 데모 사용자는 프리셋 선택 건너뜀
  if (isDemo) {
    return <TriggerForm onJobStarted={onJobStarted} />;
  }

  // Step 1: 프리셋 선택
  if (step === 'select') {
    return (
      <PresetSelector
        onSelect={(preset) => {
          setSelectedPreset(preset);
          setStep('configure');
        }}
        onSkip={() => {
          setSelectedPreset(null);
          setStep('configure');
        }}
      />
    );
  }

  // Step 2: 트리거 폼 (프리셋 적용)
  return (
    <TriggerForm
      onJobStarted={onJobStarted}
      preset={selectedPreset}
      onChangePreset={() => {
        setSelectedPreset(null);
        setStep('select');
      }}
    />
  );
}
