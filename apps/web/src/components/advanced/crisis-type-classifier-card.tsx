'use client';

import { AlertTriangle, Clock, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { AdvancedCardHelp, ADVANCED_HELP } from './advanced-help';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface RecommendedStrategy {
  strategy: 'denial' | 'evasion' | 'reduction' | 'corrective-action' | 'mortification';
  strategyName: string;
  rationale: string;
  priority: number;
}

interface GoldenTimeWindow {
  hoursRemaining: number;
  urgencyLevel: 'critical' | 'high' | 'medium' | 'low';
  rationale: string;
}

interface CrisisTypeClassifierData {
  crisisType: 'victim' | 'accidental' | 'preventable';
  crisisTypeName: string;
  crisisTypeDescription: string;
  responsibilityLevel: 'low' | 'medium' | 'high';
  recommendedStrategies: RecommendedStrategy[];
  goldenTimeWindow: GoldenTimeWindow;
  summary: string;
}

interface CrisisTypeClassifierCardProps {
  data: Record<string, unknown> | null;
}

const CRISIS_TYPE_META: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  victim: {
    label: '희생자형',
    color: 'bg-blue-500/15 text-blue-600 border-blue-500/20',
    icon: ShieldCheck,
  },
  accidental: {
    label: '사고형',
    color: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20',
    icon: Shield,
  },
  preventable: {
    label: '예방가능형',
    color: 'bg-red-500/15 text-red-600 border-red-500/20',
    icon: ShieldAlert,
  },
};

const RESPONSIBILITY_META: Record<string, { label: string; color: string }> = {
  low: { label: '낮음', color: 'bg-green-500/15 text-green-600 border-green-500/20' },
  medium: { label: '중간', color: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20' },
  high: { label: '높음', color: 'bg-red-500/15 text-red-600 border-red-500/20' },
};

const URGENCY_META: Record<string, { label: string; color: string }> = {
  critical: { label: '긴급 (0~24h)', color: 'text-red-600' },
  high: { label: '높음 (24~48h)', color: 'text-orange-600' },
  medium: { label: '중간 (48~72h)', color: 'text-yellow-600' },
  low: { label: '낮음 (72h+)', color: 'text-slate-500' },
};

const STRATEGY_LABEL: Record<string, string> = {
  denial: '부정',
  evasion: '책임 회피',
  reduction: '비중 축소',
  'corrective-action': '수정 행동',
  mortification: '완전한 사과',
};

export function CrisisTypeClassifierCard({ data }: CrisisTypeClassifierCardProps) {
  if (!data) return null;
  const d = data as unknown as CrisisTypeClassifierData;

  const crisisType = d.crisisType ?? 'accidental';
  const crisisMeta = CRISIS_TYPE_META[crisisType] ?? CRISIS_TYPE_META.accidental;
  const CrisisIcon = crisisMeta.icon;

  const responsibility = d.responsibilityLevel ?? 'medium';
  const respMeta = RESPONSIBILITY_META[responsibility] ?? RESPONSIBILITY_META.medium;

  const urgency = d.goldenTimeWindow?.urgencyLevel ?? 'medium';
  const urgencyMeta = URGENCY_META[urgency] ?? URGENCY_META.medium;

  const topStrategies = (d.recommendedStrategies ?? [])
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
    .slice(0, 3);

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg font-semibold">
          SCCT 위기 유형 분류
          <AdvancedCardHelp {...ADVANCED_HELP.crisisTypeClassifier} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 위기 유형 + 책임 수준 */}
        <div className="flex items-start gap-3 rounded-lg border p-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${crisisMeta.color}`}
          >
            <CrisisIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">{d.crisisTypeName ?? crisisMeta.label}</span>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${crisisMeta.color}`}>
                {crisisMeta.label}
              </Badge>
            </div>
            {d.crisisTypeDescription && (
              <p className="text-xs text-muted-foreground mt-1 leading-tight">
                {d.crisisTypeDescription}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-muted-foreground">귀속 책임:</span>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${respMeta.color}`}>
                {respMeta.label}
              </Badge>
            </div>
          </div>
        </div>

        {/* 골든타임 */}
        {d.goldenTimeWindow && (
          <div className="flex items-center gap-3 rounded-lg border border-dashed p-3">
            <Clock className={`h-4 w-4 shrink-0 ${urgencyMeta.color}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">골든타임</span>
                <span className={`text-xs font-semibold ${urgencyMeta.color}`}>
                  {urgencyMeta.label}
                </span>
              </div>
              {d.goldenTimeWindow.rationale && (
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                  {d.goldenTimeWindow.rationale}
                </p>
              )}
            </div>
          </div>
        )}

        {/* 권고 대응 전략 */}
        {topStrategies.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              권고 대응 전략 (우선순위순)
            </p>
            <div className="space-y-2">
              {topStrategies.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary mt-0.5">
                    {s.priority ?? i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium">
                        {s.strategyName ?? STRATEGY_LABEL[s.strategy] ?? s.strategy}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 text-muted-foreground"
                      >
                        {STRATEGY_LABEL[s.strategy] ?? s.strategy}
                      </Badge>
                    </div>
                    {s.rationale && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                        {s.rationale}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 경고: preventable 유형 특별 안내 */}
        {crisisType === 'preventable' && (
          <div className="flex items-start gap-2 rounded-md bg-red-50/50 border border-red-200/50 p-2.5 dark:bg-red-950/20 dark:border-red-900/30">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-red-600 dark:text-red-400 leading-tight">
              예방가능형 위기: 부정(denial) 또는 축소 전략 사용 시 신뢰도 추가 손상 — 완전한 책임
              인정과 수정 행동이 최우선입니다.
            </p>
          </div>
        )}

        {/* 요약 */}
        {d.summary && (
          <p className="text-xs text-muted-foreground border-t pt-3 leading-relaxed">{d.summary}</p>
        )}
      </CardContent>
    </Card>
  );
}
