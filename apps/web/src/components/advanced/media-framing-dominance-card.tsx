'use client';

import { Newspaper, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface FrameItem {
  frameName: string;
  frameType: 'diagnostic' | 'prognostic' | 'motivational';
  dominanceScore: number;
  mediaOutlets: string[];
  agendaSettingImpact: 'high' | 'medium' | 'low';
}

interface MediaFramingDominanceData {
  dominantFrame: string;
  dominantFrameScore: number;
  frames: FrameItem[];
  frameContestLevel: 'dominant' | 'contested' | 'fragmented';
  frameShiftRisk: number;
  corporateNarrativeGap: string;
  recommendation: string;
  summary: string;
}

interface MediaFramingDominanceCardProps {
  data: Record<string, unknown> | null;
}

const FRAME_TYPE_LABEL: Record<string, string> = {
  diagnostic: '문제정의',
  prognostic: '해결방향',
  motivational: '행동촉구',
};

const AGENDA_IMPACT_LABEL: Record<string, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
};

function getContestLevelBadge(level: string) {
  switch (level) {
    case 'dominant':
      return (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">단일 지배</Badge>
      );
    case 'contested':
      return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">경합 중</Badge>;
    case 'fragmented':
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">분산</Badge>;
    default:
      return <Badge variant="secondary">{level}</Badge>;
  }
}

function getAgendaImpactColor(impact: string) {
  switch (impact) {
    case 'high':
      return 'text-red-500';
    case 'medium':
      return 'text-amber-500';
    case 'low':
      return 'text-green-500';
    default:
      return 'text-muted-foreground';
  }
}

export function MediaFramingDominanceCard({ data }: MediaFramingDominanceCardProps) {
  const parsed = data as unknown as MediaFramingDominanceData | null;
  const topFrames = parsed?.frames?.slice(0, 3) ?? [];

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Newspaper className="h-4 w-4" />
            미디어 프레임 지배력
          </span>
          {parsed && getContestLevelBadge(parsed.frameContestLevel)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!parsed ? (
          <div
            className="flex items-center justify-center h-[260px] text-muted-foreground"
            role="status"
          >
            분석 데이터 없음
          </div>
        ) : (
          <>
            {/* 지배적 프레임 + 점수 바 */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">지배적 프레임</p>
              <p className="text-sm font-semibold">{parsed.dominantFrame || '분석 중'}</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${Math.min(parsed.dominantFrameScore, 100)}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                  {parsed.dominantFrameScore}
                </span>
              </div>
            </div>

            {/* 프레임 목록 (최대 3개) */}
            {topFrames.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">주요 프레임</p>
                <div className="space-y-1.5">
                  {topFrames.map((frame, i) => (
                    <div key={i} className="rounded border p-2 text-xs space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium leading-tight">{frame.frameName}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {FRAME_TYPE_LABEL[frame.frameType] ?? frame.frameType}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-400 rounded-full"
                              style={{ width: `${Math.min(frame.dominanceScore, 100)}%` }}
                            />
                          </div>
                          <span className="text-muted-foreground tabular-nums">
                            {frame.dominanceScore}
                          </span>
                        </div>
                        <span
                          className={`font-medium ${getAgendaImpactColor(frame.agendaSettingImpact)}`}
                        >
                          의제설정 {AGENDA_IMPACT_LABEL[frame.agendaSettingImpact]}
                        </span>
                      </div>
                      {frame.mediaOutlets.length > 0 && (
                        <p className="text-muted-foreground truncate">
                          {frame.mediaOutlets.slice(0, 3).join(' · ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 프레임 전환 위험도 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground flex items-center gap-1">
                  {parsed.frameShiftRisk >= 60 ? (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  ) : (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  )}
                  프레임 전환 위험도
                </span>
                <span className="tabular-nums font-semibold">{parsed.frameShiftRisk}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    parsed.frameShiftRisk >= 60
                      ? 'bg-red-500'
                      : parsed.frameShiftRisk >= 40
                        ? 'bg-amber-500'
                        : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(parsed.frameShiftRisk, 100)}%` }}
                />
              </div>
            </div>

            {/* 기업 서사 간극 */}
            {parsed.corporateNarrativeGap && (
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground">기업 서사 간극</p>
                <p className="text-xs text-foreground leading-relaxed">
                  {parsed.corporateNarrativeGap}
                </p>
              </div>
            )}

            {/* 권고사항 */}
            {parsed.recommendation && (
              <p className="text-xs text-muted-foreground leading-relaxed border-t pt-3">
                {parsed.recommendation}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
