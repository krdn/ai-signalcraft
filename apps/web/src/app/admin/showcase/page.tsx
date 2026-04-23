'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { trpcClient } from '@/lib/trpc';

export default function AdminShowcasePage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'showcase', 'list', page],
    queryFn: () => trpcClient.admin.showcase.list.query({ page, pageSize: 20 }),
  });

  const toggle = useMutation({
    mutationFn: (input: { jobId: number; featured: boolean }) =>
      trpcClient.admin.showcase.toggle.mutate(input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'showcase'] });
      toast.success(result.featured ? '쇼케이스로 지정되었습니다' : '쇼케이스에서 해제되었습니다');
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const featuredCount = data?.featuredCount ?? 0;
  const maxFeatured = data?.maxFeatured ?? 5;
  const isMaxReached = featuredCount >= maxFeatured;
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">쇼케이스 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            랜딩 페이지와 데모 사용자에게 보여줄 샘플 분석을 선택합니다
          </p>
        </div>
        <Badge variant={isMaxReached ? 'destructive' : 'secondary'} className="text-sm px-3 py-1">
          <Star className="mr-1 h-3.5 w-3.5" />
          {featuredCount}/{maxFeatured}
        </Badge>
      </div>

      {/* 현재 쇼케이스 요약 */}
      {data?.items.filter((i) => i.isFeatured).length ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">현재 쇼케이스 항목</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.items
                .filter((i) => i.isFeatured)
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-lg border p-3 bg-primary/5"
                  >
                    <Star className="mt-0.5 h-4 w-4 text-primary fill-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{item.keyword}</p>
                      {item.oneLiner && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {item.oneLiner}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(item.createdAt), 'yyyy-MM-dd')}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* 완료 작업 테이블 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">완료된 분석 작업</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <TooltipProvider>
                <Table>
                  <caption className="sr-only">완료된 분석 작업 목록</caption>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">쇼케이스</TableHead>
                      <TableHead>키워드</TableHead>
                      <TableHead>한 줄 요약</TableHead>
                      <TableHead className="w-28">생성일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.items.map((item) => {
                      const disabled = !item.isFeatured && isMaxReached;
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            {disabled ? (
                              <Tooltip>
                                <TooltipTrigger>
                                  <div>
                                    <Switch checked={false} disabled />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>최대 {maxFeatured}개까지 가능합니다</TooltipContent>
                              </Tooltip>
                            ) : (
                              <Switch
                                checked={item.isFeatured}
                                onCheckedChange={(checked) =>
                                  toggle.mutate({ jobId: item.id, featured: checked })
                                }
                                disabled={toggle.isPending}
                              />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{item.keyword}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                            {item.oneLiner ?? '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(item.createdAt), 'yyyy-MM-dd')}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TooltipProvider>

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    이전
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    다음
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
