'use client';

import { AlertTriangle, CheckCircle } from 'lucide-react';
import { getModelWarnings } from './llm-recommendation-data';
import { MODULE_META } from '@/components/settings/module-meta';

interface ModuleModel {
  moduleName: string;
  provider: string;
  model: string;
  status: string;
}

interface ProblemDiagnosisTabProps {
  modules: ModuleModel[];
}

const WARNING_STYLE: Record<string, string> = {
  'korean-limited': 'bg-amber-100 text-amber-800 border-amber-200',
  underspec: 'bg-red-100 text-red-800 border-red-200',
  'context-limit': 'bg-orange-100 text-orange-800 border-orange-200',
};

export function ProblemDiagnosisTab({ modules }: ProblemDiagnosisTabProps) {
  const diagnosed = modules.map((m) => ({
    ...m,
    warnings: getModelWarnings(m.moduleName, m.model),
  }));

  const problemModules = diagnosed.filter((m) => m.warnings.length > 0);
  const okModules = diagnosed.filter((m) => m.warnings.length === 0);

  return (
    <div className="space-y-4">
      <div
        className={`rounded-lg border p-3 ${problemModules.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}
      >
        <p className="text-sm font-medium">
          {problemModules.length > 0
            ? `⚠️ ${problemModules.length}개 모듈에서 주의가 필요합니다`
            : '✅ 모든 모듈이 최적 상태입니다'}
        </p>
      </div>

      {problemModules.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            주의 필요
          </p>
          {problemModules.map((m) => {
            const meta = MODULE_META[m.moduleName];
            return (
              <div
                key={m.moduleName}
                className="rounded-lg border border-amber-200 bg-amber-50/50 p-3"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{meta?.name ?? m.moduleName}</p>
                    <p className="text-xs text-muted-foreground">{m.model}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {m.warnings.map((w) => (
                        <span
                          key={w.type}
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${WARNING_STYLE[w.type] ?? 'bg-gray-100 text-gray-800'}`}
                        >
                          {w.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {okModules.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            정상
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {okModules.map((m) => {
              const meta = MODULE_META[m.moduleName];
              return (
                <div
                  key={m.moduleName}
                  className="flex items-center gap-2 rounded-lg border bg-card p-3"
                >
                  <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{meta?.name ?? m.moduleName}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.model}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
