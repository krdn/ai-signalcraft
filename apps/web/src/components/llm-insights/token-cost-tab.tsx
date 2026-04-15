'use client';

import { MODULE_META } from '@/components/settings/module-meta';

interface TokenCostItem {
  moduleName: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

interface TokenCostTabProps {
  items: TokenCostItem[];
  total: { inputTokens: number; outputTokens: number; costUsd: number };
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatUsd(n: number): string {
  if (n < 0.0001) return '<$0.0001';
  return `$${n.toFixed(4)}`;
}

export function TokenCostTab({ items, total }: TokenCostTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-lg font-bold text-blue-600">{formatTokens(total.inputTokens)}</p>
          <p className="text-xs text-muted-foreground">총 입력 토큰</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-lg font-bold text-purple-600">{formatTokens(total.outputTokens)}</p>
          <p className="text-xs text-muted-foreground">총 출력 토큰</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-lg font-bold text-green-600">{formatUsd(total.costUsd)}</p>
          <p className="text-xs text-muted-foreground">총 비용 (USD)</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                모듈
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                모델
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                입력
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                출력
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                비용
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => {
              const meta = MODULE_META[item.moduleName];
              return (
                <tr key={item.moduleName} className="hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <span className="text-xs font-medium">{meta?.name ?? item.moduleName}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-xs text-muted-foreground">{item.model}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">
                    {formatTokens(item.inputTokens)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">
                    {formatTokens(item.outputTokens)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-medium tabular-nums">
                    {formatUsd(item.costUsd)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/50 font-semibold">
              <td className="px-3 py-2 text-xs" colSpan={2}>
                합계
              </td>
              <td className="px-3 py-2 text-right text-xs tabular-nums">
                {formatTokens(total.inputTokens)}
              </td>
              <td className="px-3 py-2 text-right text-xs tabular-nums">
                {formatTokens(total.outputTokens)}
              </td>
              <td className="px-3 py-2 text-right text-xs tabular-nums">
                {formatUsd(total.costUsd)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
