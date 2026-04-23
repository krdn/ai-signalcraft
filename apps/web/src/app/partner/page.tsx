'use client';

import { useQuery } from '@tanstack/react-query';
import { DollarSign, Handshake, TrendingUp, Users } from 'lucide-react';
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

export default function PartnerDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['partner', 'dashboard'],
    queryFn: () => trpcClient.partner.dashboard.query(),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">파트너 대시보드</h1>
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">파트너 대시보드</h1>
        <p className="text-muted-foreground">영업 현황과 수수료를 한눈에 확인하세요</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="전체 고객"
          value={data?.totalClients ?? 0}
          subtitle={`계약: ${data?.contractedClients ?? 0}건`}
          icon={Users}
        />
        <StatCard
          title="진행중 딜"
          value={data?.negotiatingClients ?? 0}
          subtitle="협상 진행 중"
          icon={Handshake}
        />
        <StatCard
          title="이번달 수수료"
          value={`${(data?.monthlyCommission ?? 0).toLocaleString()}만원`}
          icon={DollarSign}
        />
        <StatCard
          title="누적 수수료"
          value={`${(data?.totalCommission ?? 0).toLocaleString()}만원`}
          icon={TrendingUp}
        />
      </div>
    </div>
  );
}
