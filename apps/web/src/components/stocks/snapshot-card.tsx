'use client';

interface Snapshot {
  ticker: string;
  asOf: string;
  price: { last: number; change: number; changePct: number };
  fundamentals: { marketCap: number; pe: number | null };
  recommendations: { rating: string; targetMean: number };
}

export function SnapshotCard({ snapshot }: { snapshot: Snapshot }) {
  const { price, fundamentals, recommendations } = snapshot;
  const up = price.change >= 0;
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-slate-900">{snapshot.ticker}</h2>
        <span className="text-xs text-slate-400">
          {new Date(snapshot.asOf).toLocaleString('ko-KR')}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="text-2xl font-semibold">${price.last.toFixed(2)}</span>
        <span className={up ? 'text-green-600' : 'text-red-600'}>
          {up ? '+' : ''}
          {price.change.toFixed(2)} ({price.changePct.toFixed(2)}%)
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <div>
          <dt className="text-slate-400">시가총액</dt>
          <dd>${(fundamentals.marketCap / 1e9).toFixed(1)}B</dd>
        </div>
        <div>
          <dt className="text-slate-400">PER</dt>
          <dd>{fundamentals.pe?.toFixed(1) ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-400">애널리스트</dt>
          <dd>{recommendations.rating}</dd>
        </div>
        <div>
          <dt className="text-slate-400">목표가(평균)</dt>
          <dd>${recommendations.targetMean.toFixed(2)}</dd>
        </div>
      </dl>
    </div>
  );
}
