'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Briefcase,
  CheckCircle,
  DollarSign,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpcClient } from '@/lib/trpc';

export default function PartnerToolsPage() {
  const [selectedPartner, setSelectedPartner] = useState<string>('');

  const { data } = useQuery({
    queryKey: ['sales', 'partnerTools', 'performance', selectedPartner],
    queryFn: () =>
      trpcClient.sales.partnerTools.partnerPerformance.query({
        partnerId: selectedPartner || undefined,
      }),
  });

  const { data: materials } = useQuery({
    queryKey: ['sales', 'partnerTools', 'materials'],
    queryFn: () => trpcClient.sales.partnerTools.salesMaterials.query(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">파트너 지원</h1>
        <p className="text-muted-foreground">파트너 실적을 확인하고 영업 자료를 관리하세요</p>
      </div>

      {/* 파트너 선택 + 실적 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">파트너별 실적</CardTitle>
            <Select value={selectedPartner} onValueChange={(v) => setSelectedPartner(v ?? '')}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="파트너 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">전체</SelectItem>
                {(data?.partners ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name ?? p.email}
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      {p.role}
                    </Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {data?.detail ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{data.detail.totalClients}</p>
                  <p className="text-xs text-muted-foreground">
                    전체 고객 (계약: {data.detail.contractedClients})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Target className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{data.detail.referredLeads}</p>
                  <p className="text-xs text-muted-foreground">
                    소개 리드 (성사: {data.detail.wonLeads})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">
                    {data.detail.totalCommission.toLocaleString()}만원
                  </p>
                  <p className="text-xs text-muted-foreground">누적 수수료</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              파트너를 선택하면 상세 실적이 표시됩니다
            </p>
          )}
        </CardContent>
      </Card>

      {/* 영업 자료 */}
      {materials && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* 요금제 비교 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                요금제
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(materials.pricing).map(([key, plan]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{plan.name}</p>
                      <p className="text-xs text-muted-foreground">{plan.description}</p>
                    </div>
                    <span className="text-lg font-bold text-primary">{plan.price}만원/월</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 경쟁 비교 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                비용 비교
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(materials.comparisons).map(([key, comp]) => (
                  <div
                    key={key}
                    className={`flex items-center justify-between p-3 border rounded-lg ${
                      key === 'signalCraft' ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <div>
                      <p className="font-medium">{comp.name}</p>
                      <p className="text-xs text-muted-foreground">{comp.scope}</p>
                    </div>
                    <span className="font-medium">{comp.cost}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 핵심 셀링 포인트 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                핵심 셀링 포인트
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {materials.keyBenefits.map((benefit, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* 활용 사례 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                타겟 고객
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {materials.useCases.map((uc, i) => (
                  <div key={i} className="p-3 bg-muted/50 rounded-lg">
                    <p className="font-medium text-sm">{uc.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{uc.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
