'use client';

import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { AdvancedCardHelp, ADVANCED_HELP } from './advanced-help';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
interface ChallengingFrame {
  name: string;
  description: string;
  strength: number;
  source: string;
  spreadRisk: 'high' | 'medium' | 'low';
}

interface FrameDynamics {
  currentBalance: 'institution_dominant' | 'contested' | 'student_dominant';
  trendDirection: 'institution_gaining' | 'stable' | 'student_gaining';
  flashpoints: string[];
  turningConditions: string[];
}

interface InstitutionOfficialFrame {
  name: string;
  description: string;
  strength: number;
  credibilityScore: number;
  gaps: string[];
}

interface DominantFrame {
  name: string;
  description: string;
  strength: number;
  mainCarriers: string[];
  platforms: string[];
}

interface KeyMessages {
  forAdmissions: string[];
  forStudents: string[];
  framesToAvoid: string[];
}

interface EducationOpinionFrameData {
  dominantFrame: DominantFrame;
  challengingFrames: ChallengingFrame[];
  institutionOfficialFrame: InstitutionOfficialFrame;
  frameDynamics: FrameDynamics;
  keyMessages: KeyMessages;
  summary: string;
}

interface EducationOpinionFrameCardProps {
  data: Record<string, unknown> | null;
}

const BALANCE_LABEL: Record<string, { label: string; color: string }> = {
  institution_dominant: { label: '기관 우세', color: 'text-green-600' },
  contested: { label: '경합 중', color: 'text-yellow-600' },
  student_dominant: { label: '학생 우세', color: 'text-red-600' },
};

const TREND_LABEL: Record<string, string> = {
  institution_gaining: '기관 강화 중',
  stable: '유지',
  student_gaining: '학생 측 강화 중',
};

const SPREAD_RISK_COLOR: Record<string, string> = {
  high: 'bg-red-500/15 text-red-600 border-red-500/20',
  medium: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20',
  low: 'bg-green-500/15 text-green-600 border-green-500/20',
};

const SPREAD_RISK_LABEL: Record<string, string> = {
  high: '확산 위험',
  medium: '주의',
  low: '안전',
};

function StrengthBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const color =
    pct >= 70 ? '[&>div]:bg-blue-500' : pct >= 40 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500';
  return <Progress value={pct} className={`h-1.5 flex-1 ${color}`} />;
}

export function EducationOpinionFrameCard({ data }: EducationOpinionFrameCardProps) {
  if (!data) return null;
  const d = data as unknown as EducationOpinionFrameData;

  const balance = d.frameDynamics?.currentBalance ?? 'contested';
  const balanceMeta = BALANCE_LABEL[balance] ?? BALANCE_LABEL.contested;
  const trendDir = d.frameDynamics?.trendDirection ?? 'stable';
  const challengingFrames = (d.challengingFrames ?? []).slice(0, 3);
  const turningConditions = (d.frameDynamics?.turningConditions ?? []).slice(0, 3);
  const forAdmissions = (d.keyMessages?.forAdmissions ?? []).slice(0, 2);

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg font-semibold">
          교육 여론 프레임
          <AdvancedCardHelp {...ADVANCED_HELP.educationOpinionFrame} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 세력 균형 */}
        <div className="rounded-lg border p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">현재 프레임 세력 균형</span>
            <span className={`text-sm font-semibold ${balanceMeta.color}`}>
              {balanceMeta.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {trendDir === 'institution_gaining' ? (
              <TrendingUp className="h-3 w-3 text-green-500" />
            ) : trendDir === 'student_gaining' ? (
              <TrendingDown className="h-3 w-3 text-red-500" />
            ) : (
              <Minus className="h-3 w-3 text-slate-400" />
            )}
            {TREND_LABEL[trendDir]}
          </div>
        </div>

        {/* 지배 프레임 */}
        {d.dominantFrame && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">지배 프레임</p>
            <div className="rounded-md border border-blue-200 bg-blue-50/50 p-2.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium">{d.dominantFrame.name}</span>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-600 border-blue-500/20"
                >
                  강도 {d.dominantFrame.strength}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {d.dominantFrame.description}
              </p>
            </div>
          </div>
        )}

        {/* 기관 공식 프레임 신뢰도 */}
        {d.institutionOfficialFrame && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">
              기관 공식 프레임 신뢰도
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-24 shrink-0 truncate">
                {d.institutionOfficialFrame.name}
              </span>
              <StrengthBar value={d.institutionOfficialFrame.credibilityScore ?? 0} />
              <span className="text-xs font-medium min-w-[28px] text-right">
                {d.institutionOfficialFrame.credibilityScore ?? 0}
              </span>
            </div>
          </div>
        )}

        {/* 도전 프레임 */}
        {challengingFrames.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">도전 프레임</p>
            <div className="space-y-1.5">
              {challengingFrames.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 shrink-0 ${SPREAD_RISK_COLOR[f.spreadRisk ?? 'medium']}`}
                  >
                    {SPREAD_RISK_LABEL[f.spreadRisk ?? 'medium']}
                  </Badge>
                  <span className="text-xs truncate">{f.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 전환 트리거 */}
        {turningConditions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">프레임 전환 트리거</p>
            <ul className="space-y-1">
              {turningConditions.map((c, i) => (
                <li key={i} className="flex gap-1.5 text-[10px] text-muted-foreground">
                  <span className="text-green-500 shrink-0">→</span>
                  <span className="leading-tight">{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 입시 대상 메시지 */}
        {forAdmissions.length > 0 && (
          <div className="rounded-md bg-slate-50 border p-2">
            <p className="text-[10px] font-medium text-muted-foreground mb-1">입시 메시지 방향</p>
            {forAdmissions.map((m, i) => (
              <p key={i} className="text-[10px] text-muted-foreground leading-tight">
                {m}
              </p>
            ))}
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
