'use client';

import { useState } from 'react';
import { SignalBadge } from './signal-badge';

// tickerlens 타입 (로컬 정의 — 클라이언트 번들에 tickerlens 끌어오지 않기 위함)
interface PerspectiveResult {
  signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  confidence: number;
  thesis: string;
  evidence: { label: string; value: string }[];
  risks: string[];
  catalysts: string[];
}
type Slot = { ok: true; value: PerspectiveResult } | { ok: false; error: { message: string } };

export function PerspectiveCell({ slot, timeframe }: { slot: Slot; timeframe: string }) {
  const [open, setOpen] = useState(false);

  if (!slot.ok) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
        <div className="font-medium">{timeframe}</div>
        <div className="mt-1">분석 실패: {slot.error.message}</div>
      </div>
    );
  }

  const p = slot.value;
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="w-full rounded border border-slate-200 p-3 text-left text-xs transition hover:border-slate-300"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-slate-500">{timeframe}</span>
        <SignalBadge signal={p.signal} />
      </div>
      <div className="mt-1 text-slate-400">신뢰도 {Math.round(p.confidence * 100)}%</div>
      <p className="mt-2 line-clamp-2 text-slate-700">{p.thesis}</p>
      {open && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-2">
          {p.evidence.length > 0 && (
            <div>
              <div className="font-medium text-slate-600">근거</div>
              <ul className="mt-1 space-y-0.5">
                {p.evidence.map((e, i) => (
                  <li key={i} className="text-slate-600">
                    {e.label}: {e.value}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.risks.length > 0 && (
            <div>
              <div className="font-medium text-slate-600">리스크</div>
              <ul className="mt-1 list-disc pl-4 text-slate-600">
                {p.risks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {p.catalysts.length > 0 && (
            <div>
              <div className="font-medium text-slate-600">촉매</div>
              <ul className="mt-1 list-disc pl-4 text-slate-600">
                {p.catalysts.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </button>
  );
}
