'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { SubscriptionSummary } from '../../analysis/subscription-picker';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { SOURCE_META } from '@/components/analysis/source-icons';

const OPTIMIZATION_OPTIONS = [
  { value: 'rag-standard', label: 'RAG 표준 (권장)' },
  { value: 'rag-light', label: 'RAG 경량' },
  { value: 'rag-aggressive', label: 'RAG 적극적' },
  { value: 'standard', label: '표준' },
  { value: 'none', label: '없음' },
] as const;

const DOMAINS = [
  { value: 'general', label: '일반' },
  { value: 'political', label: '정치' },
  { value: 'economic', label: '경제' },
  { value: 'technology', label: '기술' },
  { value: 'social', label: '사회' },
  { value: 'fandom', label: '팬덤' },
  { value: 'pr', label: 'PR/홍보' },
  { value: 'corporate', label: '기업' },
  { value: 'finance', label: '금융' },
  { value: 'healthcare', label: '의료' },
  { value: 'sports', label: '스포츠' },
  { value: 'education', label: '교육' },
] as const;

const DATE_PRESETS = [
  { label: '최근 1일', days: 1 },
  { label: '최근 3일', days: 3 },
  { label: '최근 7일', days: 7 },
  { label: '최근 14일', days: 14 },
  { label: '최근 30일', days: 30 },
] as const;

interface AnalysisConfigStepProps {
  subscription: SubscriptionSummary;
  onTrigger: (jobId: number) => void;
  onBack: () => void;
}

export function AnalysisConfigStep({ subscription, onTrigger, onBack }: AnalysisConfigStepProps) {
  const [days, setDays] = useState(7);
  const [domain, setDomain] = useState(subscription.domain || 'general');
  const [optimization, setOptimization] = useState<string>('rag-standard');

  const triggerMutation = useMutation({
    mutationFn: (input: {
      subscriptionId: number;
      startDate: string;
      endDate: string;
      domain?: string;
      optimizationPreset?: string;
    }) => trpcClient.analysis.triggerSubscription.mutate(input as any),
    onSuccess: (data) => {
      toast.success('분석이 시작되었습니다');
      onTrigger(data.jobId);
    },
    onError: () => {
      toast.error('분석 실행에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    },
  });

  const handleTrigger = () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - days);

    triggerMutation.mutate({
      subscriptionId: subscription.id,
      startDate: start.toISOString(),
      endDate: now.toISOString(),
      domain,
      optimizationPreset: optimization,
    });
  };

  return (
    <div className="space-y-6">
      {/* 선택된 구독 요약 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">선택된 구독</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <span className="font-medium">{subscription.keyword}</span>
            <div className="flex gap-1">
              {subscription.sources.map((s) => {
                const meta = SOURCE_META[s];
                const Icon = meta?.icon;
                const label = meta?.label ?? s;
                return (
                  <Badge key={s} variant="secondary" className="text-xs gap-1">
                    {Icon && <Icon className="h-3 w-3" />}
                    {label}
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 분석 기간 */}
      <div className="space-y-2">
        <Label>분석 기간</Label>
        <div className="flex flex-wrap gap-2">
          {DATE_PRESETS.map((p) => (
            <Button
              key={p.days}
              variant={days === p.days ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDays(p.days)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* 도메인 */}
      <div className="space-y-2">
        <Label>분석 도메인</Label>
        <Select value={domain} onValueChange={(v) => v && setDomain(v)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOMAINS.map((d) => (
              <SelectItem key={d.value} value={d.value}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 토큰 최적화 */}
      <div className="space-y-2">
        <Label>토큰 최적화</Label>
        <Select value={optimization} onValueChange={(v) => v && setOptimization(v)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPTIMIZATION_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 실행 버튼 */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          이전
        </Button>
        <Button onClick={handleTrigger} disabled={triggerMutation.isPending}>
          {triggerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          분석 실행
        </Button>
      </div>
    </div>
  );
}
