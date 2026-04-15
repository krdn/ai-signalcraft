'use client';

import { CheckCircle } from 'lucide-react';
import { MODULE_RECOMMENDATIONS } from './llm-recommendation-data';
import { MODULE_META } from '@/components/settings/module-meta';
import { Badge } from '@/components/ui/badge';

interface ModuleModel {
  moduleName: string;
  provider: string;
  model: string;
  status: string;
}

interface UpgradeSuggestionsTabProps {
  modules: ModuleModel[];
}

const TIER_LABEL: Record<string, string> = {
  best: '최고',
  standard: '보통',
  minimal: '최소',
};

const TIER_STYLE: Record<string, string> = {
  best: 'bg-purple-100 text-purple-800 border-purple-200',
  standard: 'bg-blue-100 text-blue-800 border-blue-200',
  minimal: 'bg-gray-100 text-gray-800 border-gray-200',
};

export function UpgradeSuggestionsTab({ modules }: UpgradeSuggestionsTabProps) {
  return (
    <div className="space-y-3">
      {modules.map((m) => {
        const meta = MODULE_META[m.moduleName];
        const rec = MODULE_RECOMMENDATIONS[m.moduleName];

        if (!rec) return null;

        const tiers = [
          { key: 'best', ...rec.best },
          { key: 'standard', ...rec.standard },
          { key: 'minimal', ...rec.minimal },
        ] as const;

        return (
          <div key={m.moduleName} className="rounded-lg border bg-card p-4">
            <p className="mb-3 text-sm font-semibold">{meta?.name ?? m.moduleName}</p>
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <span>현재:</span>
              <Badge variant="outline" className="text-xs">
                {m.model}
              </Badge>
            </div>
            <div className="space-y-2">
              {tiers.map((tier) => {
                const isCurrent = tier.model === m.model;
                return (
                  <div
                    key={tier.key}
                    className={`flex items-start gap-3 rounded-md p-2 ${isCurrent ? 'border border-green-200 bg-green-50' : 'bg-muted/40'}`}
                  >
                    <span
                      className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium ${TIER_STYLE[tier.key]}`}
                    >
                      {TIER_LABEL[tier.key]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{tier.model}</span>
                        {isCurrent && (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle className="h-3 w-3" /> 현재 사용 중
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{tier.reason}</p>
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
