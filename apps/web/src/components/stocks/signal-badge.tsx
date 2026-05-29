type Signal = 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
type Tone = 'positive' | 'neutral' | 'negative';

interface SignalMeta {
  label: string;
  tone: Tone;
  className: string;
}

const MAP: Record<Signal, SignalMeta> = {
  strong_buy: { label: '적극 매수', tone: 'positive', className: 'bg-green-100 text-green-800' },
  buy: { label: '매수', tone: 'positive', className: 'bg-green-50 text-green-700' },
  hold: { label: '보유', tone: 'neutral', className: 'bg-slate-100 text-slate-700' },
  sell: { label: '매도', tone: 'negative', className: 'bg-red-50 text-red-700' },
  strong_sell: { label: '적극 매도', tone: 'negative', className: 'bg-red-100 text-red-800' },
};

export function signalMeta(signal: Signal): SignalMeta {
  return MAP[signal];
}

export function SignalBadge({ signal }: { signal: Signal }) {
  const meta = signalMeta(signal);
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}
