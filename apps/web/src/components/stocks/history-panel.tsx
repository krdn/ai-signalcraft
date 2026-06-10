'use client';

import { useState, useEffect } from 'react';
import { trpcClient } from '@/lib/trpc';

interface HistoryRow {
  id: number;
  ticker: string;
  depth: string;
  requestedBy: string;
  createdAt: string | Date;
}

export function HistoryPanel({
  onSelect,
  refreshKey,
}: {
  onSelect: (id: number) => void;
  refreshKey: number;
}) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    trpcClient.stocks.list
      .query({ limit: 20 })
      .then((r) => setRows(r as HistoryRow[]))
      .catch(() => setError('이력을 불러오지 못했습니다.'));
  }, [refreshKey]);

  if (error) {
    return <p className="text-xs text-red-600">{error}</p>;
  }

  if (rows.length === 0) {
    return <p className="text-xs text-slate-400">분석 이력이 없습니다.</p>;
  }

  return (
    <ul className="space-y-1">
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            onClick={() => onSelect(row.id)}
            className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100"
          >
            <span className="font-medium text-slate-800">{row.ticker}</span>{' '}
            <span className="text-slate-400">
              · {row.requestedBy} · {new Date(row.createdAt).toLocaleString('ko-KR')}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
