'use client';

import { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { trpcClient } from '@/lib/trpc';

type Category = 'feature' | 'fix' | 'pipeline' | 'chore' | 'breaking';
type Scope = 'user' | 'internal';

const CATEGORY_LABEL: Record<Category, string> = {
  feature: '기능',
  fix: '수정',
  pipeline: '파이프라인',
  chore: '기타',
  breaking: '주요 변경',
};

const CATEGORY_VARIANT: Record<Category, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  feature: 'default',
  fix: 'secondary',
  pipeline: 'outline',
  chore: 'outline',
  breaking: 'destructive',
};

function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ChangelogPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
  const [scopeFilter, setScopeFilter] = useState<Scope | 'all'>('user');

  const { data, isLoading } = useQuery({
    queryKey: ['changelog', 'list', page],
    queryFn: () => trpcClient.release.list.query({ page, pageSize: 20 }),
  });

  // 페이지 진입 시 읽음 처리
  const markAsRead = useMutation({
    mutationFn: () => trpcClient.release.markAsRead.mutate(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['release', 'unreadCount'] });
    },
  });

  useEffect(() => {
    markAsRead.mutate();
  }, []); // 페이지 진입 시 1회만

  const filteredItems = useMemo(() => {
    if (!data) return [];
    return data.items
      .map((release) => ({
        ...release,
        entries: release.entries.filter((e) => {
          if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
          if (scopeFilter !== 'all' && e.scope !== scopeFilter) return false;
          return true;
        }),
      }))
      .filter((r) => r.entries.length > 0);
  }, [data, categoryFilter, scopeFilter]);

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <main aria-label="업데이트 히스토리" className="container max-w-4xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">업데이트 히스토리</h1>
        <p className="text-muted-foreground mt-2">
          AI SignalCraft의 새로운 기능과 개선 사항을 확인하세요.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <Tabs value={scopeFilter} onValueChange={(v) => setScopeFilter(v as Scope | 'all')}>
          <TabsList>
            <TabsTrigger value="user">사용자 기능</TabsTrigger>
            <TabsTrigger value="internal">내부 변경</TabsTrigger>
            <TabsTrigger value="all">전체</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-2 flex-wrap">
          {(['all', 'feature', 'fix', 'pipeline', 'chore', 'breaking'] as const).map((cat) => (
            <Button
              key={cat}
              variant={categoryFilter === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoryFilter(cat)}
            >
              {cat === 'all' ? '전체' : CATEGORY_LABEL[cat]}
            </Button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      )}

      {!isLoading && filteredItems.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            표시할 업데이트가 없습니다.
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {filteredItems.map((release) => (
          <Card key={release.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="text-xl">{release.version}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDate(release.deployedAt)}
                  </p>
                </div>
                {release.summary && (
                  <p className="text-sm text-muted-foreground max-w-md text-right">
                    {release.summary}
                  </p>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {release.entries.map((entry) => (
                  <li key={entry.id} className="flex gap-3 items-start">
                    <Badge
                      variant={CATEGORY_VARIANT[entry.category as Category]}
                      className="mt-0.5 shrink-0"
                    >
                      {CATEGORY_LABEL[entry.category as Category]}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{entry.title}</p>
                      {entry.description && (
                        <p className="text-sm text-muted-foreground mt-1">{entry.description}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            이전
          </Button>
          <span className="px-4 py-2 text-sm">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            다음
          </Button>
        </div>
      )}
    </main>
  );
}
