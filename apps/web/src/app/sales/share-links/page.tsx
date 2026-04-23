'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, ExternalLink, Link2, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { trpcClient } from '@/lib/trpc';

export default function ShareLinksPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sales', 'shareLinks'],
    queryFn: () => trpcClient.sales.shareLinks.list.query({ page: 1, pageSize: 50 }),
  });

  const createMutation = useMutation({
    mutationFn: (input: {
      jobId: number;
      customTitle?: string;
      expiresInDays?: number;
      password?: string;
    }) => trpcClient.sales.shareLinks.create.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'shareLinks'] });
      setDialogOpen(false);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      trpcClient.sales.shareLinks.update.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'shareLinks'] });
    },
  });

  const copyLink = (token: string, id: string) => {
    const url = `${window.location.origin}/shared/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">리포트 공유</h1>
          <p className="text-muted-foreground">
            분석 리포트를 외부에 공유할 수 있는 링크를 관리하세요
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button>
                <Link2 className="h-4 w-4 mr-2" />
                공유 링크 생성
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>공유 링크 생성</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createMutation.mutate({
                  jobId: Number(fd.get('jobId')),
                  customTitle: (fd.get('customTitle') as string) || undefined,
                  expiresInDays: fd.get('expiresInDays')
                    ? Number(fd.get('expiresInDays'))
                    : undefined,
                  password: (fd.get('password') as string) || undefined,
                });
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="jobId">작업 ID *</Label>
                <Input id="jobId" name="jobId" type="number" required placeholder="분석 작업 ID" />
                <p className="text-xs text-muted-foreground mt-1">
                  대시보드 히스토리에서 확인 가능
                </p>
              </div>
              <div>
                <Label htmlFor="customTitle">커스텀 제목</Label>
                <Input id="customTitle" name="customTitle" placeholder="공유 시 표시될 제목" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="expiresInDays">만료일 (일)</Label>
                  <Input
                    id="expiresInDays"
                    name="expiresInDays"
                    type="number"
                    min="1"
                    max="90"
                    placeholder="30"
                  />
                </div>
                <div>
                  <Label htmlFor="password">비밀번호 (선택)</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="설정 시 비밀번호 필요"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? '생성 중...' : '링크 생성'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">공유 링크 목록</caption>
              <thead>
                <tr className="border-b bg-muted/50">
                  <th scope="col" className="text-left px-4 py-3 font-medium">
                    제목 / 키워드
                  </th>
                  <th scope="col" className="text-center px-4 py-3 font-medium">
                    상태
                  </th>
                  <th scope="col" className="text-center px-4 py-3 font-medium">
                    조회수
                  </th>
                  <th scope="col" className="text-center px-4 py-3 font-medium">
                    다운로드
                  </th>
                  <th scope="col" className="text-left px-4 py-3 font-medium">
                    만료일
                  </th>
                  <th scope="col" className="text-left px-4 py-3 font-medium">
                    생성일
                  </th>
                  <th scope="col" className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading &&
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="h-5 bg-muted rounded animate-pulse" />
                      </td>
                    </tr>
                  ))}
                {data?.items.map((link) => {
                  const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();
                  return (
                    <tr key={link.id} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {link.customTitle ?? link.keyword ?? `작업 #${link.jobId}`}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={link.isActive && !isExpired ? 'default' : 'secondary'}>
                          {!link.isActive ? '비활성' : isExpired ? '만료' : '활성'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center font-medium">{link.viewCount}</td>
                      <td className="px-4 py-3 text-center">{link.downloadCount}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {link.expiresAt
                          ? new Date(link.expiresAt).toLocaleDateString('ko-KR')
                          : '무제한'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(link.createdAt).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => copyLink(link.token, link.id)}
                          >
                            {copiedId === link.id ? (
                              <span className="text-xs text-emerald-600">복사됨</span>
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <a
                            href={`/shared/${link.token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                          {link.isActive && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600"
                              onClick={() =>
                                toggleMutation.mutate({ id: link.id, isActive: false })
                              }
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!isLoading && data?.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      공유 링크가 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
