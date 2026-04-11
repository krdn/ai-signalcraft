'use client';

import { Music } from 'lucide-react';
import { AdvancedCardHelp, ADVANCED_HELP } from './advanced-help';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SuccessFactor {
  factor: string;
  currentStatus: 'strong' | 'moderate' | 'weak' | 'unknown';
  importance: number;
}

interface RiskFactor {
  factor: string;
  riskLevel: 'high' | 'medium' | 'low';
  mitigation: string;
}

interface CrossPlatformOutlook {
  platform: string;
  expectedSentiment: string;
  keyMetric: string;
}

interface ActionPlan {
  action: string;
  expectedImpact: string;
  priority: 'high' | 'medium' | 'low';
  timing: string;
}

interface ReleasePredictionData {
  predictedReception: 'explosive' | 'positive' | 'mixed' | 'negative' | 'controversial';
  receptionScore: number;
  successFactors: SuccessFactor[];
  riskFactors: RiskFactor[];
  crossPlatformOutlook: CrossPlatformOutlook[];
  actionPlan: ActionPlan[];
}

interface ReleasePredictionCardProps {
  data: Record<string, unknown> | null;
}

const RECEPTION_CONFIG: Record<string, { label: string; color: string }> = {
  explosive: { label: '폭발적', color: 'bg-purple-500/15 text-purple-500 border-purple-500/20' },
  positive: { label: '긍정적', color: 'bg-green-500/15 text-green-500 border-green-500/20' },
  mixed: { label: '혼합', color: 'bg-amber-500/15 text-amber-500 border-amber-500/20' },
  negative: { label: '부정적', color: 'bg-red-500/15 text-red-500 border-red-500/20' },
  controversial: { label: '논란', color: 'bg-orange-500/15 text-orange-500 border-orange-500/20' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  strong: { label: '강점', color: 'text-green-500' },
  moderate: { label: '보통', color: 'text-amber-500' },
  weak: { label: '약점', color: 'text-red-500' },
  unknown: { label: '미확인', color: 'text-gray-500' },
};

function getPriorityBadge(priority: string) {
  switch (priority) {
    case 'high':
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">긴급</Badge>;
    case 'medium':
      return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">보통</Badge>;
    case 'low':
      return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">여유</Badge>;
    default:
      return <Badge variant="secondary">{priority}</Badge>;
  }
}

export function ReleasePredictionCard({ data }: ReleasePredictionCardProps) {
  const parsed = data as unknown as ReleasePredictionData | null;

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-1.5">
          <Music className="h-5 w-5" />
          컴백/신곡 반응 예측
          <AdvancedCardHelp {...ADVANCED_HELP.releaseReceptionPrediction} />
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
            {/* 예측 결과 */}
            <div className="flex items-center justify-between">
              <Badge className={RECEPTION_CONFIG[parsed.predictedReception]?.color ?? ''}>
                {RECEPTION_CONFIG[parsed.predictedReception]?.label ?? parsed.predictedReception}
              </Badge>
              <div className="text-right">
                <span className="text-3xl font-bold tabular-nums">{parsed.receptionScore}</span>
                <span className="text-lg font-bold ml-1">/100</span>
              </div>
            </div>

            {/* 성공 요인 */}
            {parsed.successFactors.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">성공 요인</p>
                {parsed.successFactors.map((f, i) => {
                  const status = STATUS_CONFIG[f.currentStatus] ?? STATUS_CONFIG.unknown;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span>{f.factor}</span>
                        <span className={`font-medium ${status.color}`}>{status.label}</span>
                      </div>
                      <div className="h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${f.importance}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 플랫폼별 전망 */}
            {parsed.crossPlatformOutlook.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">플랫폼별 전망</p>
                <div className="rounded border text-xs">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-2 py-1 text-left font-medium">플랫폼</th>
                        <th className="px-2 py-1 text-left font-medium">예상 반응</th>
                        <th className="px-2 py-1 text-left font-medium">핵심 지표</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.crossPlatformOutlook.map((outlook, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-2 py-1">{outlook.platform}</td>
                          <td className="px-2 py-1">{outlook.expectedSentiment}</td>
                          <td className="px-2 py-1">{outlook.keyMetric}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 행동 계획 */}
            {parsed.actionPlan.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">권고 행동</p>
                {parsed.actionPlan.map((plan, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {getPriorityBadge(plan.priority)}
                    <span className="flex-1">{plan.action}</span>
                    <span className="text-muted-foreground">{plan.timing}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
