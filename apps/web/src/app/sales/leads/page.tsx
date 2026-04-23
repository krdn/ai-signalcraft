'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

const STAGE_COLORS: Record<string, string> = {
  lead: 'bg-gray-100 text-gray-700',
  contacted: 'bg-blue-100 text-blue-700',
  demo: 'bg-purple-100 text-purple-700',
  proposal: 'bg-amber-100 text-amber-700',
  negotiation: 'bg-orange-100 text-orange-700',
  closed_won: 'bg-emerald-100 text-emerald-700',
  closed_lost: 'bg-red-100 text-red-700',
};

const SOURCE_LABELS: Record<string, string> = {
  cold_email: '콜드 이메일',
  inbound: '인바운드',
  partner_referral: '파트너 소개',
  demo_signup: '데모 가입',
  event: '이벤트',
  other: '기타',
};

type StageValue =
  | 'lead'
  | 'contacted'
  | 'demo'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';
type SourceValue =
  | 'cold_email'
  | 'inbound'
  | 'partner_referral'
  | 'demo_signup'
  | 'event'
  | 'other';

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['sales', 'leads', page, search, stageFilter, sourceFilter],
    queryFn: () =>
      trpcClient.sales.leads.list.query({
        page,
        pageSize: 20,
        search: search || undefined,
        stage: stageFilter !== 'all' ? (stageFilter as StageValue) : undefined,
        source: sourceFilter !== 'all' ? (sourceFilter as SourceValue) : undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (input: {
      companyName: string;
      contactName: string;
      contactEmail?: string;
      contactPhone?: string;
      companySize?: '1-10' | '11-50' | '51-200' | '201-1000' | '1000+';
      industry?: string;
      source?: SourceValue;
      expectedPlan?: 'starter' | 'professional' | 'campaign';
      expectedRevenue?: number;
      notes?: string;
    }) => trpcClient.sales.leads.create.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'leads'] });
      setDialogOpen(false);
    },
  });

  const totalPages = Math.ceil((data?.total ?? 0) / 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">리드 관리</h1>
          <p className="text-muted-foreground">잠재 고객을 관리하고 영업 파이프라인을 추적하세요</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                리드 등록
              </Button>
            }
          />
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>새 리드 등록</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createMutation.mutate({
                  companyName: fd.get('companyName') as string,
                  contactName: fd.get('contactName') as string,
                  contactEmail: (fd.get('contactEmail') as string) || undefined,
                  contactPhone: (fd.get('contactPhone') as string) || undefined,
                  companySize: (fd.get('companySize') as '1-10') || undefined,
                  industry: (fd.get('industry') as string) || undefined,
                  source: (fd.get('source') as SourceValue) || 'other',
                  expectedPlan: (fd.get('expectedPlan') as 'starter') || undefined,
                  expectedRevenue: fd.get('expectedRevenue')
                    ? Number(fd.get('expectedRevenue'))
                    : undefined,
                  notes: (fd.get('notes') as string) || undefined,
                });
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="companyName">회사명 *</Label>
                  <Input id="companyName" name="companyName" required />
                </div>
                <div>
                  <Label htmlFor="contactName">담당자명 *</Label>
                  <Input id="contactName" name="contactName" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="contactEmail">이메일</Label>
                  <Input id="contactEmail" name="contactEmail" type="email" />
                </div>
                <div>
                  <Label htmlFor="contactPhone">전화번호</Label>
                  <Input id="contactPhone" name="contactPhone" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="companySize">회사 규모</Label>
                  <select
                    id="companySize"
                    name="companySize"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">선택</option>
                    <option value="1-10">1~10명</option>
                    <option value="11-50">11~50명</option>
                    <option value="51-200">51~200명</option>
                    <option value="201-1000">201~1000명</option>
                    <option value="1000+">1000명+</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="industry">업종</Label>
                  <Input id="industry" name="industry" placeholder="예: PR에이전시" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="source">유입 소스</Label>
                  <select
                    id="source"
                    name="source"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="expectedPlan">예상 요금제</Label>
                  <select
                    id="expectedPlan"
                    name="expectedPlan"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">선택</option>
                    <option value="starter">Starter (49만원)</option>
                    <option value="professional">Professional (129만원)</option>
                    <option value="campaign">Campaign (249만원)</option>
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="expectedRevenue">예상 월 매출 (만원)</Label>
                <Input id="expectedRevenue" name="expectedRevenue" type="number" min="0" />
              </div>
              <div>
                <Label htmlFor="notes">메모</Label>
                <Textarea id="notes" name="notes" rows={2} />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? '등록 중...' : '리드 등록'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="회사명, 담당자, 이메일 검색..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={stageFilter}
          onValueChange={(v) => {
            if (v) {
              setStageFilter(v);
              setPage(1);
            }
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="스테이지" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 스테이지</SelectItem>
            {Object.entries(STAGE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sourceFilter}
          onValueChange={(v) => {
            if (v) {
              setSourceFilter(v);
              setPage(1);
            }
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="소스" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 소스</SelectItem>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 테이블 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">리드 목록</caption>
              <thead>
                <tr className="border-b bg-muted/50">
                  <th scope="col" className="text-left px-4 py-3 font-medium">
                    회사명
                  </th>
                  <th scope="col" className="text-left px-4 py-3 font-medium">
                    담당자
                  </th>
                  <th scope="col" className="text-left px-4 py-3 font-medium">
                    스테이지
                  </th>
                  <th scope="col" className="text-left px-4 py-3 font-medium">
                    소스
                  </th>
                  <th scope="col" className="text-right px-4 py-3 font-medium">
                    예상 매출
                  </th>
                  <th scope="col" className="text-center px-4 py-3 font-medium">
                    점수
                  </th>
                  <th scope="col" className="text-left px-4 py-3 font-medium">
                    담당
                  </th>
                  <th scope="col" className="text-left px-4 py-3 font-medium">
                    수정일
                  </th>
                  <th scope="col" className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={9} className="px-4 py-3">
                        <div className="h-5 bg-muted rounded animate-pulse" />
                      </td>
                    </tr>
                  ))}
                {data?.items.map((lead) => (
                  <tr key={lead.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{lead.companyName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {lead.contactName}
                      {lead.contactEmail && (
                        <span className="block text-xs">{lead.contactEmail}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={STAGE_COLORS[lead.stage]}>
                        {STAGE_LABELS[lead.stage]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {SOURCE_LABELS[lead.source]}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {lead.expectedRevenue ? `${lead.expectedRevenue.toLocaleString()}만원` : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                          lead.score >= 70
                            ? 'bg-emerald-100 text-emerald-700'
                            : lead.score >= 40
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {lead.score}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.assignedName ?? '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(lead.updatedAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/sales/leads/${lead.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
                {!isLoading && data?.items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      리드가 없습니다. 첫 리드를 등록해 보세요.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            이전
          </Button>
          <span className="flex items-center text-sm text-muted-foreground px-3">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            다음
          </Button>
        </div>
      )}
    </div>
  );
}
