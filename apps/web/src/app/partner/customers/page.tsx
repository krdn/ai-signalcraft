'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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

const STATUS_MAP: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  prospect: { label: '잠재', variant: 'secondary' },
  negotiating: { label: '협상중', variant: 'default' },
  contracted: { label: '계약', variant: 'outline' },
  churned: { label: '이탈', variant: 'destructive' },
};

export default function PartnerClientsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['partner', 'clients', page],
    queryFn: () => trpcClient.partner.myClients.list.query({ page, pageSize: 20 }),
  });

  const addMutation = useMutation({
    mutationFn: (input: {
      clientName: string;
      clientEmail?: string;
      clientCompany?: string;
      planType?: 'starter' | 'professional' | 'campaign';
      notes?: string;
    }) => trpcClient.partner.myClients.add.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner', 'clients'] });
      setDialogOpen(false);
    },
  });

  const [form, setForm] = useState({
    clientName: '',
    clientEmail: '',
    clientCompany: '',
    planType: '' as string,
    notes: '',
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    addMutation.mutate({
      clientName: form.clientName,
      clientEmail: form.clientEmail || undefined,
      clientCompany: form.clientCompany || undefined,
      planType: (form.planType as 'starter' | 'professional' | 'campaign') || undefined,
      notes: form.notes || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">고객 관리</h1>
          <p className="text-muted-foreground">유치한 고객을 관리하세요</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="mr-1 size-4" />
                고객 추가
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>고객 추가</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="partner-clientName">고객명 *</Label>
                <Input
                  id="partner-clientName"
                  value={form.clientName}
                  onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="partner-clientEmail">이메일</Label>
                  <Input
                    id="partner-clientEmail"
                    type="email"
                    value={form.clientEmail}
                    onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partner-clientCompany">회사명</Label>
                  <Input
                    id="partner-clientCompany"
                    value={form.clientCompany}
                    onChange={(e) => setForm({ ...form, clientCompany: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-planType">관심 플랜</Label>
                <Select
                  value={form.planType}
                  onValueChange={(v) => {
                    if (v) setForm({ ...form, planType: v });
                  }}
                >
                  <SelectTrigger id="partner-planType">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter (49만원/월)</SelectItem>
                    <SelectItem value="professional">Professional (129만원/월)</SelectItem>
                    <SelectItem value="campaign">Campaign (249만원/월)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-notes">메모</Label>
                <Input
                  id="partner-notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={addMutation.isPending}>
                {addMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                추가
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <caption className="sr-only">고객 관리 목록</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>고객명</TableHead>
                  <TableHead>회사</TableHead>
                  <TableHead>플랜</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-right">월 매출</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <EmptyState
                        title="등록된 고객이 없습니다"
                        description="고객 추가 버튼으로 유치한 고객을 등록하세요"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.items.map((client) => {
                    const statusInfo = STATUS_MAP[client.status] ?? {
                      label: client.status,
                      variant: 'secondary' as const,
                    };
                    return (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">
                          {client.clientName}
                          {client.clientEmail && (
                            <div className="text-xs text-muted-foreground">
                              {client.clientEmail}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{client.clientCompany ?? '-'}</TableCell>
                        <TableCell>
                          {client.planType ? (
                            <Badge variant="outline" className="capitalize">
                              {client.planType}
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {client.monthlyRevenue != null
                            ? `${client.monthlyRevenue.toLocaleString()}만원`
                            : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data && data.total > 20 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            이전
          </Button>
          <span className="flex items-center text-sm text-muted-foreground">
            {page} / {Math.ceil(data.total / 20)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(data.total / 20)}
          >
            다음
          </Button>
        </div>
      )}
    </div>
  );
}
