'use client';

import { PROVIDER_REGISTRY, type AIProvider } from '@ai-signalcraft/core/ai-meta';
import { MODULE_STAGE } from './llm-recommendation-data';
import { MODULE_META } from '@/components/settings/module-meta';
import { Badge } from '@/components/ui/badge';

interface ModuleModel {
  moduleName: string;
  provider: string;
  model: string;
  status: string;
}

interface ModelOverviewTabProps {
  modules: ModuleModel[];
}

function ProviderBadge({ provider }: { provider: string }) {
  const meta = PROVIDER_REGISTRY[provider as AIProvider];
  const displayName = meta?.displayName ?? provider;

  const colorMap: Record<string, string> = {
    anthropic: 'bg-amber-100 text-amber-800 border-amber-200',
    gemini: 'bg-blue-100 text-blue-800 border-blue-200',
    openai: 'bg-green-100 text-green-800 border-green-200',
    deepseek: 'bg-purple-100 text-purple-800 border-purple-200',
    xai: 'bg-red-100 text-red-800 border-red-200',
    openrouter: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    'claude-cli': 'bg-amber-100 text-amber-800 border-amber-200',
    'gemini-cli': 'bg-teal-100 text-teal-800 border-teal-200',
  };
  const colorClass = colorMap[provider] ?? 'bg-gray-100 text-gray-800 border-gray-200';

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {displayName}
    </span>
  );
}

export function ModelOverviewTab({ modules }: ModelOverviewTabProps) {
  const stageGroups: Record<string, ModuleModel[]> = { '1': [], '2': [], '3': [], '4': [] };
  for (const m of modules) {
    const stage = String(MODULE_STAGE[m.moduleName] ?? 4);
    stageGroups[stage].push(m);
  }

  const stageLabels: Record<string, string> = {
    '1': 'Stage 1 — 구조 분석 (병렬)',
    '2': 'Stage 2 — 전략 심화 (순차)',
    '3': 'Stage 3 — 최종 요약',
    '4': 'Stage 4 — 고급 시뮬레이션',
  };

  return (
    <div className="space-y-6">
      {(['1', '2', '3', '4'] as const).map((stage) => {
        const items = stageGroups[stage];
        if (items.length === 0) return null;
        return (
          <div key={stage}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {stageLabels[stage]}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {items.map((m) => {
                const meta = MODULE_META[m.moduleName];
                return (
                  <div key={m.moduleName} className="rounded-lg border bg-card p-3">
                    <p className="mb-2 text-sm font-semibold">{meta?.name ?? m.moduleName}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <ProviderBadge provider={m.provider} />
                      <Badge variant="secondary" className="text-xs">
                        {m.model}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
