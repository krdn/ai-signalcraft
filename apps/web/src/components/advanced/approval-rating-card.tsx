'use client';

import { useState, useMemo } from 'react';
import { Pie, PieChart, Cell } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ApprovalRatingData {
  estimatedRange: { min: number; max: number };
  confidence: 'high' | 'medium' | 'low';
  methodology: {
    sentimentRatio: { positive: number; neutral: number; negative: number };
    platformBiasCorrection: Array<{
      platform: string;
      biasDirection: 'left' | 'right' | 'neutral';
      correctionFactor: number;
    }>;
    spreadFactor: number;
  };
  disclaimer: string;
  reasoning: string;
}

interface ApprovalRatingCardProps {
  data: Record<string, unknown> | null;
}

const sentimentChartConfig = {
  positive: { label: '긍정', color: 'hsl(142 71% 45%)' },
  neutral: { label: '중립', color: 'hsl(240 5% 64%)' },
  negative: { label: '부정', color: 'hsl(0 84% 60%)' },
} satisfies ChartConfig;

const SENTIMENT_COLORS = ['hsl(142 71% 45%)', 'hsl(240 5% 64%)', 'hsl(0 84% 60%)'];

function getConfidenceBadge(confidence: string) {
  switch (confidence) {
    case 'high':
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">높음</Badge>;
    case 'medium':
      return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">보통</Badge>;
    case 'low':
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">낮음</Badge>;
    default:
      return <Badge variant="secondary">{confidence}</Badge>;
  }
}

const BIAS_LABELS: Record<string, string> = {
  left: '진보 편향',
  right: '보수 편향',
  neutral: '중립',
};

export function ApprovalRatingCard({ data }: ApprovalRatingCardProps) {
  const [showReasoning, setShowReasoning] = useState(false);
  const parsed = data as unknown as ApprovalRatingData | null;

  const sentimentData = useMemo(() => {
    if (!parsed?.methodology?.sentimentRatio) return [];
    const { positive, neutral, negative } = parsed.methodology.sentimentRatio;
    return [
      { name: 'positive', value: positive, fill: SENTIMENT_COLORS[0] },
      { name: 'neutral', value: neutral, fill: SENTIMENT_COLORS[1] },
      { name: 'negative', value: negative, fill: SENTIMENT_COLORS[2] },
    ];
  }, [parsed]);

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center justify-between">
          AI 지지율 추정
          {parsed && getConfidenceBadge(parsed.confidence)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!parsed ? (
          <div className="flex items-center justify-center h-[260px] text-muted-foreground" role="status">
            데이터 없음
          </div>
        ) : (
          <>
            {/* 추정 범위 -- 큰 숫자 */}
            <div className="text-center">
              <span className="text-4xl font-bold tabular-nums">
                {parsed.estimatedRange.min}~{parsed.estimatedRange.max}
              </span>
              <span className="text-2xl font-bold ml-1">%</span>
            </div>

            {/* 감정 비율 도넛 차트 */}
            {sentimentData.length > 0 && (
              <ChartContainer config={sentimentChartConfig} className="mx-auto aspect-square max-h-[160px]">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <Pie
                    data={sentimentData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={40}
                    outerRadius={65}
                    strokeWidth={2}
                  >
                    {sentimentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}

            {/* 플랫폼 편향 보정 테이블 */}
            {parsed.methodology.platformBiasCorrection.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">플랫폼 편향 보정</p>
                <div className="rounded border text-xs">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-2 py-1 text-left font-medium">플랫폼</th>
                        <th className="px-2 py-1 text-left font-medium">편향</th>
                        <th className="px-2 py-1 text-right font-medium">보정계수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.methodology.platformBiasCorrection.map((item, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-2 py-1">{item.platform}</td>
                          <td className="px-2 py-1">{BIAS_LABELS[item.biasDirection] ?? item.biasDirection}</td>
                          <td className="px-2 py-1 text-right font-mono">{item.correctionFactor.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 추론 과정 (접이식) */}
            <div>
              <button
                type="button"
                onClick={() => setShowReasoning(!showReasoning)}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {showReasoning ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                추론 과정
              </button>
              {showReasoning && (
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {parsed.reasoning}
                </p>
              )}
            </div>

            {/* 면책 문구 (per D-05) */}
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed border-t pt-3">
              {parsed.disclaimer}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
