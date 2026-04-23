'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Plus, Send, Trash2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpcClient } from '@/lib/trpc';

const CATEGORY_LABELS: Record<string, string> = {
  cold_outreach: '초기 접근',
  follow_up: '팔로업',
  demo_invite: '데모 초대',
  proposal: '제안서',
  partner_intro: '파트너 소개',
};

const STATUS_LABELS: Record<string, string> = {
  sent: '발송됨',
  delivered: '전달됨',
  opened: '열람',
  bounced: '반송',
  failed: '실패',
};

const STATUS_COLORS: Record<string, string> = {
  sent: 'bg-blue-100 text-blue-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  opened: 'bg-purple-100 text-purple-700',
  bounced: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
};

type CategoryValue = 'cold_outreach' | 'follow_up' | 'demo_invite' | 'proposal' | 'partner_intro';

export default function EmailsPage() {
  const queryClient = useQueryClient();
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<{
    id: string;
    subject: string;
    body: string;
    variables?: string[] | null;
  } | null>(null);

  const { data: templates } = useQuery({
    queryKey: ['sales', 'emails', 'templates'],
    queryFn: () => trpcClient.sales.emails.templates.list.query({}),
  });

  const { data: logs } = useQuery({
    queryKey: ['sales', 'emails', 'logs'],
    queryFn: () => trpcClient.sales.emails.sendLogs.query({ page: 1, pageSize: 50 }),
  });

  const createTemplateMutation = useMutation({
    mutationFn: (input: { name: string; category: CategoryValue; subject: string; body: string }) =>
      trpcClient.sales.emails.templates.create.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'emails', 'templates'] });
      setTemplateDialogOpen(false);
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => trpcClient.sales.emails.templates.delete.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'emails', 'templates'] });
    },
  });

  const seedMutation = useMutation({
    mutationFn: () => trpcClient.sales.emails.templates.seedDefaults.mutate(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'emails', 'templates'] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (input: {
      templateId?: string;
      recipientEmail: string;
      subject: string;
      body: string;
      variables?: Record<string, string>;
    }) => trpcClient.sales.emails.send.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'emails', 'logs'] });
      setSendDialogOpen(false);
      setSelectedTemplate(null);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">이메일 관리</h1>
          <p className="text-muted-foreground">이메일 템플릿을 관리하고 영업 이메일을 발송하세요</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            기본 템플릿 생성
          </Button>
          <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
            <DialogTrigger
              render={
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  템플릿 추가
                </Button>
              }
            />
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>이메일 템플릿 추가</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  createTemplateMutation.mutate({
                    name: fd.get('name') as string,
                    category: fd.get('category') as CategoryValue,
                    subject: fd.get('subject') as string,
                    body: fd.get('body') as string,
                  });
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="name">이름 *</Label>
                    <Input id="name" name="name" required />
                  </div>
                  <div>
                    <Label htmlFor="category">카테고리</Label>
                    <select
                      id="category"
                      name="category"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="subject">제목 *</Label>
                  <Input
                    id="subject"
                    name="subject"
                    required
                    placeholder="변수: {{contactName}}, {{companyName}}"
                  />
                </div>
                <div>
                  <Label htmlFor="body">본문 (HTML) *</Label>
                  <Textarea
                    id="body"
                    name="body"
                    required
                    rows={8}
                    placeholder="<p>{{contactName}}님 안녕하세요...</p>"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createTemplateMutation.isPending}
                >
                  {createTemplateMutation.isPending ? '추가 중...' : '템플릿 추가'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="templates">
        <TabsList aria-label="이메일 탭">
          <TabsTrigger value="templates">템플릿 ({templates?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="logs">발송 이력 ({logs?.total ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4 mt-4">
          {(templates ?? []).length === 0 && (
            <Card>
              <CardContent>
                <EmptyState
                  icon={<Mail className="h-12 w-12" />}
                  title="템플릿이 없습니다"
                  description="기본 템플릿을 생성하여 이메일 발송을 시작해보세요"
                  action={
                    <Button
                      variant="outline"
                      onClick={() => seedMutation.mutate()}
                      disabled={seedMutation.isPending}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      기본 템플릿 생성
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {(templates ?? []).map((tpl) => (
              <Card key={tpl.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{tpl.name}</CardTitle>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {CATEGORY_LABELS[tpl.category]}
                      </Badge>
                      {tpl.isDefault && (
                        <Badge variant="outline" className="text-[10px]">
                          기본
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium mb-1">{tpl.subject}</p>
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {tpl.body.replace(/<[^>]+>/g, '').slice(0, 150)}...
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedTemplate(tpl);
                        setSendDialogOpen(true);
                      }}
                    >
                      <Send className="h-3.5 w-3.5 mr-1" />
                      발송
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => deleteTemplateMutation.mutate(tpl.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-3 font-medium">수신자</th>
                      <th className="text-left px-4 py-3 font-medium">제목</th>
                      <th className="text-left px-4 py-3 font-medium">리드</th>
                      <th className="text-center px-4 py-3 font-medium">상태</th>
                      <th className="text-left px-4 py-3 font-medium">발송일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(logs?.items ?? []).map((log) => (
                      <tr key={log.id} className="border-b">
                        <td className="px-4 py-3">{log.recipientEmail}</td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                          {log.subject}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {log.companyName ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="secondary" className={STATUS_COLORS[log.status]}>
                            {STATUS_LABELS[log.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {new Date(log.createdAt).toLocaleString('ko-KR')}
                        </td>
                      </tr>
                    ))}
                    {(logs?.items ?? []).length === 0 && (
                      <tr>
                        <td colSpan={5}>
                          <EmptyState
                            title="발송 이력이 없습니다"
                            description="이메일을 발송하면 이력이 여기에 표시됩니다"
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 이메일 발송 다이얼로그 */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>이메일 발송</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              sendMutation.mutate({
                templateId: selectedTemplate?.id,
                recipientEmail: fd.get('recipientEmail') as string,
                subject: fd.get('subject') as string,
                body: fd.get('body') as string,
                variables: {
                  contactName: (fd.get('var_contactName') as string) || '',
                  companyName: (fd.get('var_companyName') as string) || '',
                },
              });
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="recipientEmail">수신자 이메일 *</Label>
              <Input id="recipientEmail" name="recipientEmail" type="email" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="var_contactName">담당자명 (변수)</Label>
                <Input id="var_contactName" name="var_contactName" placeholder="홍길동" />
              </div>
              <div>
                <Label htmlFor="var_companyName">회사명 (변수)</Label>
                <Input id="var_companyName" name="var_companyName" placeholder="주식회사 OOO" />
              </div>
            </div>
            <div>
              <Label htmlFor="subject">제목 *</Label>
              <Input
                id="subject"
                name="subject"
                required
                defaultValue={selectedTemplate?.subject ?? ''}
              />
            </div>
            <div>
              <Label htmlFor="body">본문 *</Label>
              <Textarea
                id="body"
                name="body"
                required
                rows={8}
                defaultValue={selectedTemplate?.body ?? ''}
              />
            </div>
            <Button type="submit" className="w-full" disabled={sendMutation.isPending}>
              {sendMutation.isPending ? '발송 중...' : '이메일 발송'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
