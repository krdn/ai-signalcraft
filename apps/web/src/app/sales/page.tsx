'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Clock,
  DollarSign,
  TrendingUp,
  Target,
  Phone,
  Mail,
  Users,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpcClient } from '@/lib/trpc';

const STAGE_LABELS: Record<string, string> = {
  lead: '리드',
  contacted: '연락',
  demo: '데모',
  proposal: '제안',
  negotiation: '협상',
  closed_won: '성사',
  closed_lost: '상실',
};

const _STAGE_COLORS: Record<string, string> = {
  lead: 'bg-gray-100 text-gray-700',
  contacted: 'bg-blue-100 text-blue-700',
  demo: 'bg-purple-100 text-purple-700',
  proposal: 'bg-amber-100 text-amber-700',
  negotiation: 'bg-orange-100 text-orange-700',
  closed_won: 'bg-emerald-100 text-emerald-700',
  closed_lost: 'bg-red-100 text-red-700',
};

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  demo: Target,
  proposal_sent: FileText,
  note: FileText,
  stage_change: TrendingUp,
};

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export default function SalesDashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['sales', 'dashboard', 'stats'],
    queryFn: () => trpcClient.sales.dashboard.stats.query(),
  });

  const { data: pipeline } = useQuery({
    queryKey: ['sales', 'dashboard', 'pipeline'],
    queryFn: () => trpcClient.sales.dashboard.pipelineSummary.query(),
  });

  const { data: activities } = useQuery({
    queryKey: ['sales', 'dashboard', 'activity'],
    queryFn: () => trpcClient.sales.dashboard.recentActivity.query(),
  });

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">세일즈 대시보드</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // 파이프라인에서 active 스테이지만
  const activeStages = (pipeline ?? []).filter(
    (s) => s.stage !== 'closed_won' && s.stage !== 'closed_lost',
  );
  const maxCount = Math.max(...activeStages.map((s) => s.count), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">세일즈 대시보드</h1>
        <p className="text-muted-foreground">영업 파이프라인과 주요 지표를 확인하세요</p>
      </div>

      {/* KPI 카드 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="이번 달 매출"
          value={`${(stats?.monthlyRevenue ?? 0).toLocaleString()}만원`}
          subtitle={`${stats?.monthlyWonCount ?? 0}건 계약 성사`}
          icon={DollarSign}
        />
        <StatCard
          title="파이프라인 가치"
          value={`${(stats?.pipelineValue ?? 0).toLocaleString()}만원`}
          subtitle={`${stats?.activeLeads ?? 0}건 진행 중`}
          icon={BarChart3}
        />
        <StatCard
          title="전환율"
          value={`${stats?.conversionRate ?? 0}%`}
          subtitle="성사 / (성사+상실)"
          icon={TrendingUp}
        />
        <StatCard
          title="평균 거래 기간"
          value={`${stats?.avgDealDays ?? 0}일`}
          subtitle="리드 → 계약까지"
          icon={Clock}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 파이프라인 차트 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">파이프라인 현황</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeStages.map((s) => (
                <div key={s.stage} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-16 text-right">
                    {STAGE_LABELS[s.stage] ?? s.stage}
                  </span>
                  <div className="flex-1 h-8 bg-muted rounded-md overflow-hidden relative">
                    <div
                      className="h-full bg-primary/20 rounded-md transition-all"
                      style={{ width: `${(s.count / maxCount) * 100}%` }}
                    />
                    <span className="absolute inset-0 flex items-center px-3 text-sm font-medium">
                      {s.count}건 · {s.totalRevenue.toLocaleString()}만원
                    </span>
                  </div>
                </div>
              ))}
              {activeStages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  아직 리드가 없습니다
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 최근 활동 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">최근 활동</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {(activities ?? []).map((act) => {
                const Icon = ACTIVITY_ICONS[act.type] ?? FileText;
                return (
                  <div key={act.id} className="flex gap-3 items-start">
                    <div className="mt-0.5 rounded-full bg-muted p-1.5">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{act.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {act.companyName} · {act.userName ?? '시스템'} ·{' '}
                        {new Date(act.createdAt).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </div>
                );
              })}
              {(activities ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  아직 활동이 없습니다
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
