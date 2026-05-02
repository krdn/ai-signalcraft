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
import { InfoHint } from '@/components/ui/info-hint';
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
          <CardTitle className="text-base flex items-center gap-1.5">
            선택된 구독
            <InfoHint>
              <p className="text-foreground font-medium mb-1">구독 기반 분석</p>
              <p className="text-muted-foreground">
                구독은 키워드와 데이터 소스를 미리 등록해 두는 단위입니다. 이 화면에서는 해당 구독이
                지금까지 <span className="text-foreground">자동 수집한 데이터</span>를 대상으로 AI
                분석을 실행합니다. 새 데이터를 즉시 수집하지는 않으니, 최신 여론을 보려면 구독
                모니터에서 수동 트리거를 먼저 실행하세요.
              </p>
            </InfoHint>
          </CardTitle>
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
        <Label className="flex items-center gap-1.5">
          분석 기간
          <InfoHint>
            <p className="text-foreground font-medium mb-1">기간이 길수록 폭, 짧을수록 신선도</p>
            <ul className="text-muted-foreground space-y-1">
              <li>
                • <span className="text-foreground">최근 1~3일</span> — 속보·긴급 이슈 즉각 반응
                확인. 데이터 양이 적어 결과가 거칠 수 있음
              </li>
              <li>
                • <span className="text-foreground">최근 7일 (권장)</span> — 여론 형성·확산·안정화
                흐름 파악에 가장 적절
              </li>
              <li>
                • <span className="text-foreground">최근 14~30일</span> — 장기 트렌드, 이슈 사이클
                분석. 분석 시간·비용 증가
              </li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              ※ 구독이 수집한 데이터 범위 내에서만 분석됩니다. 구독 등록 직후라면 짧은 기간을
              선택하세요.
            </p>
          </InfoHint>
        </Label>
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
        <Label className="flex items-center gap-1.5">
          분석 도메인
          <InfoHint width="w-96">
            <p className="text-foreground font-medium mb-1">도메인별 분석 관점 조정</p>
            <p className="text-muted-foreground mb-2">
              AI가 데이터를 해석할 때 사용하는 <span className="text-foreground">전문 관점</span>을
              선택합니다. 같은 댓글이라도 도메인에 따라 강조되는 인사이트가 달라집니다.
            </p>
            <ul className="text-muted-foreground space-y-0.5">
              <li>
                • <span className="text-foreground">일반</span> — 도메인 특화 없음. 키워드가 모호할
                때
              </li>
              <li>
                • <span className="text-foreground">정치</span> — 지지율, 진영 프레임, 선거 함의
              </li>
              <li>
                • <span className="text-foreground">경제·금융</span> — 시장 영향, 투자 심리, 정책
                리스크
              </li>
              <li>
                • <span className="text-foreground">기업·PR</span> — 브랜드 평판, 위기 대응,
                이해관계자
              </li>
              <li>
                • <span className="text-foreground">기술·사회</span> — 수용성, 규제 우려, 사회 변화
              </li>
              <li>
                • <span className="text-foreground">팬덤·스포츠·교육·의료</span> — 각 영역 전문
                용어와 커뮤니티 맥락 반영
              </li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              구독 등록 시 설정한 도메인이 기본값으로 채워집니다.
            </p>
          </InfoHint>
        </Label>
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
        <Label className="flex items-center gap-1.5">
          토큰 최적화
          <InfoHint width="w-[28rem]">
            <p className="text-foreground font-medium mb-1">분석에 투입할 데이터 양 조절</p>
            <p className="text-muted-foreground mb-2">
              AI에 전달할 기사·댓글 수를 줄여{' '}
              <span className="text-foreground">비용·시간을 절감</span>합니다. RAG 모드는 키워드와
              의미적으로 가까운 문서만 선별하므로 정확도 손실이 가장 적습니다.
            </p>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium text-muted-foreground">옵션</th>
                    <th className="px-2 py-1 text-left font-medium text-muted-foreground">방식</th>
                    <th className="px-2 py-1 text-left font-medium text-muted-foreground">절감</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-t">
                    <td className="px-2 py-1 text-foreground">없음</td>
                    <td className="px-2 py-1">전체 데이터 사용</td>
                    <td className="px-2 py-1">0%</td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-2 py-1 text-foreground">표준</td>
                    <td className="px-2 py-1">중복 제거 + 댓글 상위 100건</td>
                    <td className="px-2 py-1">~60%</td>
                  </tr>
                  <tr className="border-t bg-cyan-500/5">
                    <td className="px-2 py-1 text-cyan-600 font-medium">RAG 경량</td>
                    <td className="px-2 py-1">의미 관련 댓글 50건</td>
                    <td className="px-2 py-1">~40%</td>
                  </tr>
                  <tr className="border-t bg-blue-500/5">
                    <td className="px-2 py-1 text-blue-600 font-medium">RAG 표준 (권장)</td>
                    <td className="px-2 py-1">기사 30+클러스터 10, 댓글 30</td>
                    <td className="px-2 py-1">~65%</td>
                  </tr>
                  <tr className="border-t bg-violet-500/5">
                    <td className="px-2 py-1 text-violet-600 font-medium">RAG 적극적</td>
                    <td className="px-2 py-1">기사 15+클러스터 5, 댓글 15</td>
                    <td className="px-2 py-1">~80%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-muted-foreground">
              데이터가 적을 때(예: 최근 1일)는 <span className="text-foreground">없음/표준</span>이
              안전, 일반적으로는 <span className="text-foreground">RAG 표준</span>으로 시작하는 것을
              권장합니다.
            </p>
          </InfoHint>
        </Label>
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
