'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ClipboardList, Loader2, Plus, Users, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { trpcClient } from '@/lib/trpc';

export default function AdminPartnersPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">파트너 관리</h1>
      <Tabs defaultValue="applications">
        <TabsList>
          <TabsTrigger value="applications">신청 관리</TabsTrigger>
          <TabsTrigger value="partners">파트너 목록</TabsTrigger>
          <TabsTrigger value="commissions">수수료 현황</TabsTrigger>
        </TabsList>
        <TabsContent value="applications" className="mt-4">
          <ApplicationsTab />
        </TabsContent>
        <TabsContent value="partners" className="mt-4">
          <PartnersTab />
        </TabsContent>
        <TabsContent value="commissions" className="mt-4">
          <CommissionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- 신청 관리 탭 ---
function ApplicationsTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [reviewTarget, setReviewTarget] = useState<{
    id: string;
    name: string;
    action: 'approved' | 'rejected';
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'partners', 'applications', statusFilter],
    queryFn: () =>
      trpcClient.admin.partners.applications.list.query({
        status: statusFilter as 'pending' | 'approved' | 'rejected',
      }),
  });

  const reviewMutation = useMutation({
    mutationFn: (input: {
      applicationId: string;
      action: 'approved' | 'rejected';
      reviewNote?: string;
      commissionRate?: number;
    }) => trpcClient.admin.partners.applications.review.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'partners'] });
    },
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle as="h2" className="text-lg">
            파트너 신청
          </CardTitle>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              if (v) setStatusFilter(v);
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">대기중</SelectItem>
              <SelectItem value="approved">승인</SelectItem>
              <SelectItem value="rejected">거절</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <caption className="sr-only">파트너 신청 목록</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>사업자</TableHead>
                  <TableHead>프로그램</TableHead>
                  <TableHead>영업 분야</TableHead>
                  <TableHead>신청일</TableHead>
                  <TableHead>액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <EmptyState
                        icon={<ClipboardList className="h-12 w-12" />}
                        title="신청 내역이 없습니다"
                        description="새로운 파트너 신청이 들어오면 여기에 표시됩니다"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.items.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">{app.name}</TableCell>
                      <TableCell>{app.email}</TableCell>
                      <TableCell>{app.businessType === 'individual' ? '개인' : '법인'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {app.program === 'reseller' ? '리셀러' : '사업 파트너'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-32 truncate">{app.salesArea ?? '-'}</TableCell>
                      <TableCell>{new Date(app.createdAt).toLocaleDateString('ko-KR')}</TableCell>
                      <TableCell>
                        {app.status === 'pending' ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() =>
                                setReviewTarget({ id: app.id, name: app.name, action: 'approved' })
                              }
                              disabled={reviewMutation.isPending}
                            >
                              <CheckCircle2 className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                setReviewTarget({ id: app.id, name: app.name, action: 'rejected' })
                              }
                              disabled={reviewMutation.isPending}
                            >
                              <XCircle className="size-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Badge variant={app.status === 'approved' ? 'default' : 'destructive'}>
                            {app.status === 'approved' ? '승인' : '거절'}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={reviewTarget !== null}
        onOpenChange={(open) => {
          if (!open) setReviewTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {reviewTarget?.action === 'approved' ? '파트너 신청 승인' : '파트너 신청 거절'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {reviewTarget?.action === 'approved'
                ? `"${reviewTarget?.name}"님의 파트너 신청을 승인하시겠습니까?`
                : `"${reviewTarget?.name}"님의 파트너 신청을 거절하시겠습니까?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                reviewTarget &&
                reviewMutation.mutate({
                  applicationId: reviewTarget.id,
                  action: reviewTarget.action,
                })
              }
            >
              {reviewTarget?.action === 'approved' ? '승인' : '거절'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// --- 파트너 목록 탭 ---
function PartnersTab() {
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    programType: 'reseller' as 'reseller' | 'partner',
    commissionRate: 15,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'partners', 'list'],
    queryFn: () => trpcClient.admin.partners.list.query({}),
  });

  const inviteMutation = useMutation({
    mutationFn: (input: typeof inviteForm) => trpcClient.admin.partners.invite.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'partners'] });
      setInviteOpen(false);
      setInviteForm({ email: '', name: '', programType: 'reseller', commissionRate: 15 });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle as="h2" className="text-lg">
          활성 파트너
        </CardTitle>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="mr-1 size-4" />
                파트너 초대
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>파트너 직접 초대</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                inviteMutation.mutate(inviteForm);
              }}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>이름 *</Label>
                  <Input
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>이메일 *</Label>
                  <Input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>프로그램</Label>
                  <Select
                    value={inviteForm.programType}
                    onValueChange={(v) => {
                      if (v)
                        setInviteForm({ ...inviteForm, programType: v as 'reseller' | 'partner' });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reseller">리셀러</SelectItem>
                      <SelectItem value="partner">사업 파트너</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>수수료율 (%)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={inviteForm.commissionRate}
                    onChange={(e) =>
                      setInviteForm({
                        ...inviteForm,
                        commissionRate: parseInt(e.target.value) || 15,
                      })
                    }
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                초대
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <caption className="sr-only">활성 파트너 목록</caption>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>역할</TableHead>
                <TableHead>프로그램</TableHead>
                <TableHead className="text-right">수수료율</TableHead>
                <TableHead>계약 상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState
                      icon={<Users className="h-12 w-12" />}
                      title="등록된 파트너가 없습니다"
                      description="파트너 초대 버튼으로 새 파트너를 추가할 수 있습니다"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                data?.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.role === 'sales' ? '리셀러' : '파트너'}</Badge>
                    </TableCell>
                    <TableCell>
                      {p.programType
                        ? p.programType === 'reseller'
                          ? '리셀러'
                          : '사업 파트너'
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.commissionRate != null ? `${p.commissionRate}%` : '-'}
                    </TableCell>
                    <TableCell>
                      {p.contractStatus ? (
                        <Badge variant={p.contractStatus === 'active' ? 'default' : 'secondary'}>
                          {p.contractStatus === 'active' ? '활성' : p.contractStatus}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">계약 없음</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// --- 수수료 현황 탭 ---
function CommissionsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'partners', 'commissionSummary'],
    queryFn: () => trpcClient.admin.partners.commissionSummary.query(),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="text-lg">
          월별 수수료 현황
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <caption className="sr-only">월별 수수료 현황</caption>
            <TableHeader>
              <TableRow>
                <TableHead>기간</TableHead>
                <TableHead className="text-right">건수</TableHead>
                <TableHead className="text-right">총 매출</TableHead>
                <TableHead className="text-right">총 수수료</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!data || data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <EmptyState
                      title="수수료 기록이 없습니다"
                      description="파트너 활동이 발생하면 월별 수수료 현황이 여기에 표시됩니다"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row) => (
                  <TableRow key={row.periodMonth}>
                    <TableCell className="font-medium">{row.periodMonth}</TableCell>
                    <TableCell className="text-right">{row.count}건</TableCell>
                    <TableCell className="text-right">
                      {row.totalRevenue.toLocaleString()}만원
                    </TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      {row.totalCommission.toLocaleString()}만원
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
