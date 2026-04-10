'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DominantNarrative {
  narrative: string;
  description: string;
  strength: number;
  source: string;
  spreadPattern: string;
}

interface CounterNarrative {
  narrative: string;
  description: string;
  threatLevel: 'high' | 'medium' | 'low';
  originPlatform: string;
}

interface Battlefront {
  platform: string;
  issue: string;
  currentStanding: string;
}

interface FandomRivalry {
  isActive: boolean;
  rivalTargets: string[];
  battlefronts: Battlefront[];
}

interface NarrativeWarData {
  dominantNarratives: DominantNarrative[];
  counterNarratives: CounterNarrative[];
  fanbaseRivalry: FandomRivalry;
  battlefieldSummary: string;
}

interface NarrativeWarChartProps {
  data: Record<string, unknown> | null;
}

function getThreatBadge(level: string) {
  switch (level) {
    case 'high':
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">위험</Badge>;
    case 'medium':
      return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">보통</Badge>;
    case 'low':
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">낮음</Badge>;
    default:
      return <Badge variant="secondary">{level}</Badge>;
  }
}

const SOURCE_COLORS: Record<string, string> = {
  fans: 'bg-pink-500/15 text-pink-500',
  'anti-fans': 'bg-red-500/15 text-red-500',
  media: 'bg-blue-500/15 text-blue-500',
  'general-public': 'bg-gray-500/15 text-gray-500',
  company: 'bg-purple-500/15 text-purple-500',
};

export function NarrativeWarChart({ data }: NarrativeWarChartProps) {
  const parsed = data as unknown as NarrativeWarData | null;

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">내러티브 경쟁 분석</CardTitle>
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
            {/* 지배적 내러티브 */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">지배적 내러티브</p>
              {parsed.dominantNarratives.map((n, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{n.narrative}</span>
                    <Badge className={SOURCE_COLORS[n.source] ?? 'bg-gray-500/15 text-gray-500'}>
                      {n.source}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{n.description}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${n.strength}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono tabular-nums">{n.strength}%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* 대항 내러티브 */}
            {parsed.counterNarratives.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">대항 내러티브</p>
                {parsed.counterNarratives.map((n, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="flex-1">{n.narrative}</span>
                    <span className="text-muted-foreground">{n.originPlatform}</span>
                    {getThreatBadge(n.threatLevel)}
                  </div>
                ))}
              </div>
            )}

            {/* 팬덤 간 경쟁 */}
            {parsed.fanbaseRivalry.isActive && parsed.fanbaseRivalry.battlefronts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">팬덤 전선</p>
                <div className="rounded border text-xs">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-2 py-1 text-left font-medium">플랫폼</th>
                        <th className="px-2 py-1 text-left font-medium">이슈</th>
                        <th className="px-2 py-1 text-left font-medium">현황</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.fanbaseRivalry.battlefronts.map((bf, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-2 py-1">{bf.platform}</td>
                          <td className="px-2 py-1">{bf.issue}</td>
                          <td className="px-2 py-1">{bf.currentStanding}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
