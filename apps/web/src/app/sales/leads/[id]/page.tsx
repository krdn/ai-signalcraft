'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Phone,
  Mail,
  Users,
  Target,
  FileText,
  TrendingUp,
  Send,
  Building2,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label as _Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { trpcClient } from '@/lib/trpc';

const STAGE_LABELS: Record<string, string> = {
  lead: '리드',
  contacted: '연락 완료',
  demo: '데모 진행',
  proposal: '제안서 전달',
  negotiation: '협상 중',
  closed_won: '계약 성사',
  closed_lost: '기회 상실',
};

const STAGE_COLORS: Record<string, string> = {
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

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  call: '전화',
  email: '이메일',
  meeting: '미팅',
  demo: '데모',
  proposal_sent: '제안서',
  note: '메모',
};

type StageValue =
  | 'lead'
  | 'contacted'
  | 'demo'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const _router = useRouter();
  const queryClient = useQueryClient();
  const [activityType, setActivityType] = useState('note');
  const [activityTitle, setActivityTitle] = useState('');
  const [activityDesc, setActivityDesc] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sales', 'leads', params.id],
    queryFn: () => trpcClient.sales.leads.getById.query({ id: params.id }),
    enabled: !!params.id,
  });

  const stageMutation = useMutation({
    mutationFn: (stage: StageValue) =>
      trpcClient.sales.leads.updateStage.mutate({ id: params.id, stage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'leads', params.id] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'dashboard'] });
    },
  });

  const activityMutation = useMutation({
    mutationFn: (input: { leadId: string; type: string; title: string; description?: string }) =>
      trpcClient.sales.leads.addActivity.mutate(
        input as Parameters<typeof trpcClient.sales.leads.addActivity.mutate>[0],
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'leads', params.id] });
      setActivityTitle('');
      setActivityDesc('');
    },
  });

  const demoMutation = useMutation({
    mutationFn: () => trpcClient.sales.leads.inviteToDemo.mutate({ leadId: params.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'leads', params.id] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">리드를 찾을 수 없습니다</p>
        <Link href="/sales/leads">
          <Button variant="outline" className="mt-4">
            목록으로 돌아가기
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <Link href="/sales/leads">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{data.companyName}</h1>
            <Badge variant="secondary" className={STAGE_COLORS[data.stage]}>
              {STAGE_LABELS[data.stage]}
            </Badge>
            <span
              className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                data.score >= 70
                  ? 'bg-emerald-100 text-emerald-700'
                  : data.score >= 40
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              {data.score}
            </span>
          </div>
          <p className="text-muted-foreground">{data.contactName}</p>
        </div>
        {data.contactEmail && !data.demoAccountId && (
          <Button
            onClick={() => demoMutation.mutate()}
            disabled={demoMutation.isPending}
            variant="outline"
          >
            <Send className="h-4 w-4 mr-2" />
            {demoMutation.isPending ? '발송 중...' : '데모 초대'}
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 왼쪽: 정보 + 스테이지 변경 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 리드 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">리드 정보</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">회사:</span>
                  <span className="font-medium">{data.companyName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">담당자:</span>
                  <span className="font-medium">{data.contactName}</span>
                </div>
                {data.contactEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">이메일:</span>
                    <a
                      href={`mailto:${data.contactEmail}`}
                      className="text-primary hover:underline"
                    >
                      {data.contactEmail}
                    </a>
                  </div>
                )}
                {data.contactPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">전화:</span>
                    <span>{data.contactPhone}</span>
                  </div>
                )}
                {data.companySize && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">규모:</span>
                    <span>{data.companySize}명</span>
                  </div>
                )}
                {data.industry && (
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">업종:</span>
                    <span>{data.industry}</span>
                  </div>
                )}
                {data.expectedPlan && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">예상 플랜:</span>
                    <Badge variant="outline">{data.expectedPlan}</Badge>
                  </div>
                )}
                {data.expectedRevenue && (
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">예상 매출:</span>
                    <span className="font-medium">
                      {data.expectedRevenue.toLocaleString()}만원/월
                    </span>
                  </div>
                )}
              </div>
              {data.notes && (
                <div className="mt-4 p-3 bg-muted/50 rounded-md text-sm">
                  <p className="text-muted-foreground">{data.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 스테이지 변경 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">스테이지 변경</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STAGE_LABELS).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={data.stage === key ? 'default' : 'outline'}
                    disabled={data.stage === key || stageMutation.isPending}
                    onClick={() => stageMutation.mutate(key as StageValue)}
                    className="text-xs"
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 활동 기록 추가 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">활동 기록</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!activityTitle.trim()) return;
                  activityMutation.mutate({
                    leadId: params.id,
                    type: activityType,
                    title: activityTitle,
                    description: activityDesc || undefined,
                  });
                }}
                className="space-y-3"
              >
                <div className="flex gap-3">
                  <Select value={activityType} onValueChange={(v) => v && setActivityType(v)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACTIVITY_TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="활동 제목"
                    value={activityTitle}
                    onChange={(e) => setActivityTitle(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={activityMutation.isPending || !activityTitle.trim()}
                  >
                    기록
                  </Button>
                </div>
                <Textarea
                  placeholder="상세 내용 (선택)"
                  value={activityDesc}
                  onChange={(e) => setActivityDesc(e.target.value)}
                  rows={2}
                />
              </form>
            </CardContent>
          </Card>
        </div>

        {/* 오른쪽: 활동 타임라인 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">활동 타임라인</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {data.activities.map((act) => {
                const Icon = ACTIVITY_ICONS[act.type] ?? FileText;
                return (
                  <div key={act.id} className="flex gap-3 items-start">
                    <div className="mt-0.5 rounded-full bg-muted p-1.5 shrink-0">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{act.title}</p>
                      {act.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{act.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {act.userName ?? '시스템'} ·{' '}
                        {new Date(act.createdAt).toLocaleString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
              {data.activities.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  아직 활동 기록이 없습니다
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
