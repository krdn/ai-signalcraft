'use client';

import { formatTokens, formatCostUsd } from './utils';
import { estimateCostUsd } from './constants';
import type { TokenUsage } from './types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface CostSummaryProps {
  tokenUsage: TokenUsage;
}

export function CostSummary({ tokenUsage }: CostSummaryProps) {
  if (tokenUsage.byModule.length === 0) return null;

  // provider별 그룹핑
  const byProvider: Record<string, { input: number; output: number; model: string }> = {};
  for (const mod of tokenUsage.byModule) {
    const key = `${mod.provider}/${mod.model}`;
    if (!byProvider[key]) {
      byProvider[key] = { input: 0, output: 0, model: mod.model };
    }
    byProvider[key].input += mod.input;
    byProvider[key].output += mod.output;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground">비용 요약</h4>
      <Table>
        <TableHeader>
          <TableRow className="text-[10px]">
            <TableHead className="h-7 text-[10px]">모델</TableHead>
            <TableHead className="h-7 text-[10px] text-right">입력</TableHead>
            <TableHead className="h-7 text-[10px] text-right">출력</TableHead>
            <TableHead className="h-7 text-[10px] text-right">비용</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(byProvider).map(([key, val]) => (
            <TableRow key={key} className="text-xs">
              <TableCell className="py-1.5 font-mono text-[11px]">{val.model}</TableCell>
              <TableCell className="py-1.5 text-right font-mono">
                {formatTokens(val.input)}
              </TableCell>
              <TableCell className="py-1.5 text-right font-mono">
                {formatTokens(val.output)}
              </TableCell>
              <TableCell className="py-1.5 text-right font-mono">
                {formatCostUsd(estimateCostUsd(val.input, val.output, val.model))}
              </TableCell>
            </TableRow>
          ))}
          {/* 합계 행 */}
          <TableRow className="text-xs font-medium border-t-2">
            <TableCell className="py-1.5">합계</TableCell>
            <TableCell className="py-1.5 text-right font-mono">
              {formatTokens(tokenUsage.total.input)}
            </TableCell>
            <TableCell className="py-1.5 text-right font-mono">
              {formatTokens(tokenUsage.total.output)}
            </TableCell>
            <TableCell className="py-1.5 text-right font-mono font-bold">
              {formatCostUsd(tokenUsage.estimatedCostUsd)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
