'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface TickerInputProps {
  onAnalyze: (ticker: string, depth: 'full' | 'lite') => void;
  isLoading: boolean;
}

export function TickerInput({ onAnalyze, isLoading }: TickerInputProps) {
  const [ticker, setTicker] = useState('');
  const [depth, setDepth] = useState<'full' | 'lite'>('lite');

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="티커 (예: AAPL)"
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
          maxLength={10}
        />
        <Button
          onClick={() => onAnalyze(ticker.trim(), depth)}
          disabled={isLoading || !ticker.trim()}
        >
          {isLoading ? '분석 중…' : '분석'}
        </Button>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <label className="flex items-center gap-1">
          <input type="radio" checked={depth === 'lite'} onChange={() => setDepth('lite')} />
          빠른 분석 (4회 호출)
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" checked={depth === 'full'} onChange={() => setDepth('full')} />
          정밀 분석 (12회 LLM 호출, 비용 발생)
        </label>
      </div>
    </div>
  );
}
