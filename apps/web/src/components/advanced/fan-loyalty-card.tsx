'use client';

import { useState } from 'react';
import { Pie, PieChart, Cell } from 'recharts';
import { ChevronDown, ChevronUp, HeartCrack } from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface LoyaltyScore {
  overall: number;
  engagement: number;
  sentiment: number;
  advocacy: number;
}

interface ChurnIndicator {
  signal: string;
  severity: 'high' | 'medium' | 'low';
  evidence: string;
  affectedSegment: string;
}

interface LoyaltySegment {
  segment: string;
  estimatedSize: number;
  churnRisk: 'high' | 'medium' | 'low';
}

interface ViralAdvocacy {
  activeDefenders: number;
  defensePatterns: string[];
  organicPromotion: string[];
}

interface FanLoyaltyData {
  loyaltyScore: LoyaltyScore;
  churnIndicators: ChurnIndicator[];
  loyaltySegments: LoyaltySegment[];
  viralAdvocacy: ViralAdvocacy;
  recommendation: string;
}

interface FanLoyaltyCardProps {
  data: Record<string, unknown> | null;
}

const loyaltyChartConfig = {
  engagement: { label: '참여도', color: 'hsl(142 71% 45%)' },
  sentiment: { label: '감정', color: 'hsl(200 84% 60%)' },
  advocacy: { label: '옹호', color: 'hsl(280 65% 60%)' },
} satisfies ChartConfig;

const SCORE_COLORS = ['hsl(142 71% 45%)', 'hsl(200 84% 60%)', 'hsl(280 65% 60%)'];

function getSeverityBadge(severity: string) {
  switch (severity) {
    case 'high':
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">높음</Badge>;
    case 'medium':
      return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">보통</Badge>;
    case 'low':
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">낮음</Badge>;
    default:
      return <Badge variant="secondary">{severity}</Badge>;
  }
}

export function FanLoyaltyCard({ data }: FanLoyaltyCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const parsed = data as unknown as FanLoyaltyData | null;

  const scoreData = parsed
    ? [
        { name: 'engagement', value: parsed.loyaltyScore.engagement, fill: SCORE_COLORS[0] },
        { name: 'sentiment', value: parsed.loyaltyScore.sentiment, fill: SCORE_COLORS[1] },
        { name: 'advocacy', value: parsed.loyaltyScore.advocacy, fill: SCORE_COLORS[2] },
      ]
    : [];

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-1.5">
          팬덤 충성도 지수
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!parsed ? (
          <div
            className="flex items-center justify-center h-[260px] text-muted-foreground"
            role="status"
          >
            데이터 없음
          </div>
        ) : (
          <>
            {/* 종합 충성도 점수 */}
            <div className="text-center">
              <span className="text-4xl font-bold tabular-nums">{parsed.loyaltyScore.overall}</span>
              <span className="text-2xl font-bold ml-1">/100</span>
            </div>

            {/* 세부 점수 도넛 차트 */}
            {scoreData.length > 0 && (
              <ChartContainer
                config={loyaltyChartConfig}
                className="mx-auto aspect-square max-h-[160px]"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <Pie
                    data={scoreData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={40}
                    outerRadius={65}
                    strokeWidth={2}
                  >
                    {scoreData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}

            {/* 이탈 징후 */}
            {parsed.churnIndicators.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">이탈 징후</p>
                <div className="space-y-1.5">
                  {parsed.churnIndicators.map((indicator, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <HeartCrack className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      <span className="flex-1">{indicator.signal}</span>
                      {getSeverityBadge(indicator.severity)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 상세 정보 (접이식) */}
            <div>
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {showDetails ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                상세 정보
              </button>
              {showDetails && (
                <div className="mt-2 space-y-2 text-xs">
                  {/* 충성도 세그먼트 */}
                  {parsed.loyaltySegments.length > 0 && (
                    <div className="rounded border p-2 space-y-1">
                      <p className="font-medium">팬덤 세그먼트</p>
                      {parsed.loyaltySegments.map((seg, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-muted-foreground">{seg.segment}</span>
                          <div className="flex items-center gap-2">
                            <span>{seg.estimatedSize}%</span>
                            {getSeverityBadge(seg.churnRisk)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* 권고 */}
                  <p className="text-muted-foreground leading-relaxed">{parsed.recommendation}</p>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
