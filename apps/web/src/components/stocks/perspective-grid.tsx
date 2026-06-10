'use client';

import { PerspectiveCell, type Slot } from './perspective-cell';

type PersonaSlots = { long: Slot; mid: Slot; short: Slot };

interface Perspectives {
  value: PersonaSlots;
  growth: PersonaSlots;
  quant: PersonaSlots;
  options: PersonaSlots;
}

const PERSONAS: { key: keyof Perspectives; label: string }[] = [
  { key: 'value', label: 'Value (가치)' },
  { key: 'growth', label: 'Growth (성장)' },
  { key: 'quant', label: 'Quant (퀀트)' },
  { key: 'options', label: 'Options (옵션)' },
];
const TIMEFRAMES: { key: keyof PersonaSlots; label: string }[] = [
  { key: 'long', label: 'Long' },
  { key: 'mid', label: 'Mid' },
  { key: 'short', label: 'Short' },
];

export function PerspectiveGrid({ perspectives }: { perspectives: Perspectives }) {
  return (
    <div className="space-y-6">
      {PERSONAS.map((persona) => (
        <section key={persona.key}>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">{persona.label}</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {TIMEFRAMES.map((tf) => (
              <PerspectiveCell
                key={tf.key}
                timeframe={tf.label}
                slot={perspectives[persona.key][tf.key]}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
