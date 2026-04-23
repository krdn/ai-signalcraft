'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3, Briefcase, DollarSign, Sparkles, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpcClient } from '@/lib/trpc';

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
        <CardTitle as="h2" className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminOverviewPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => trpcClient.admin.overview.stats.query(),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">관리자 대시보드</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const stats = data!;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">관리자 대시보드</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="전체 사용자"
          value={stats.users.total}
          subtitle={`활성 ${stats.users.active} · 관리자 ${stats.users.admins} · 팀장 ${stats.users.leaders} · 영업 ${stats.users.sales} · 파트너 ${stats.users.partners} · 멤버 ${stats.users.members} · 데모 ${stats.users.demos}`}
          icon={Users}
        />
        <StatCard title="전체 팀" value={stats.teams.total} icon={Briefcase} />
        <StatCard
          title="전체 작업"
          value={stats.jobs.total}
          subtitle={`실행 중 ${stats.jobs.running} · 완료 ${stats.jobs.completed} · 실패 ${stats.jobs.failed}`}
          icon={BarChart3}
        />
        <StatCard title="이번 달 AI 비용" value={`$${stats.monthlyCost}`} icon={DollarSign} />
        <StatCard
          title="데모 사용자"
          value={stats.demo.total}
          subtitle={`체험 사용 ${stats.demo.converted}명`}
          icon={Sparkles}
        />
        <StatCard
          title="데모 전환"
          value="-"
          subtitle="전환율 통계는 데모 관리에서 확인"
          icon={TrendingUp}
        />
      </div>
    </div>
  );
}
