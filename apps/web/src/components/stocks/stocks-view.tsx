'use client';

import { useState, useCallback } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import { TickerInput } from './ticker-input';
import { SnapshotCard } from './snapshot-card';
import { PerspectiveGrid } from './perspective-grid';
import { HistoryPanel } from './history-panel';
import { trpcClient } from '@/lib/trpc';
import type { AppRouter } from '@/server/trpc/router';

type RouterOutputs = inferRouterOutputs<AppRouter>;
// analyze는 { id, ...AnalysisResult }를 반환 — id를 제외해 getById(jsonb result)와 동일 형태로 통일
type AnalysisResult = Omit<RouterOutputs['stocks']['analyze'], 'id'>;

export function StocksView() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleAnalyze = useCallback((ticker: string, depth: 'full' | 'lite') => {
    setIsLoading(true);
    setError(null);
    trpcClient.stocks.analyze
      .mutate({ ticker, depth })
      .then((res) => {
        setResult(res);
        setRefreshKey((k) => k + 1);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '분석 실패'))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSelectHistory = useCallback((id: number) => {
    setIsLoading(true);
    setError(null);
    trpcClient.stocks.getById
      .query({ id })
      // result는 jsonb(unknown) — tickerlens AnalysisResult가 저장된 단일 경계 캐스트
      .then((row) => setResult(row.result as AnalysisResult))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '조회 실패'))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <TickerInput onAnalyze={handleAnalyze} isLoading={isLoading} />
        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {isLoading && (
          <p className="text-sm text-slate-500">분석 중입니다… (정밀 분석은 수십 초 소요)</p>
        )}
        {result && !isLoading && (
          <div className="space-y-4">
            <SnapshotCard snapshot={result.snapshot} />
            <PerspectiveGrid perspectives={result.perspectives} />
          </div>
        )}
      </div>
      <aside>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">최근 분석 (팀 공유)</h3>
        <HistoryPanel onSelect={handleSelectHistory} refreshKey={refreshKey} />
      </aside>
    </div>
  );
}
