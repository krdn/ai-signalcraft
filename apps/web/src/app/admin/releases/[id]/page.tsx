'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

interface EntryDraft {
  id: number;
  title: string;
  description: string;
  category: Category;
  scope: Scope;
  originalMessage: string;
  commitSha: string;
  authorName: string | null;
  dirty: boolean;
}

export default function AdminReleaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = use(params);
  const id = Number(idStr);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [summary, setSummary] = useState('');
  const [summaryDirty, setSummaryDirty] = useState(false);
  const [entries, setEntries] = useState<EntryDraft[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'releases', 'get', id],
    queryFn: () => trpcClient.admin.releases.getById.query({ id }),
  });

  useEffect(() => {
    if (data) {
      setSummary(data.summary ?? '');
      setSummaryDirty(false);
      setEntries(
        data.entries.map((e) => ({
          id: e.id,
          title: e.title,
          description: e.description ?? '',
          category: e.category as Category,
          scope: e.scope as Scope,
          originalMessage: e.originalMessage,
          commitSha: e.commitSha,
          authorName: e.authorName,
          dirty: false,
        })),
      );
    }
  }, [data]);

  const updateReleaseMutation = useMutation({
    mutationFn: (input: { summary: string | null }) =>
      trpcClient.admin.releases.updateRelease.mutate({ id, ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'releases', 'get', id] });
      toast.success('저장했습니다');
      setSummaryDirty(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateEntryMutation = useMutation({
    mutationFn: (input: {
      id: number;
      title: string;
      description: string | null;
      category: Category;
      scope: Scope;
    }) => trpcClient.admin.releases.updateEntry.mutate(input),
    onSuccess: (_, vars) => {
      setEntries((prev) => prev.map((e) => (e.id === vars.id ? { ...e, dirty: false } : e)));
      toast.success('항목 저장');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (entryId: number) => trpcClient.admin.releases.deleteEntry.mutate({ id: entryId }),
    onSuccess: (_, entryId) => {
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      toast.success('항목 삭제');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const publishMutation = useMutation({
    mutationFn: () => trpcClient.admin.releases.publish.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'releases'] });
      toast.success('발행했습니다');
      router.push('/admin/releases');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateEntry = (entryId: number, patch: Partial<EntryDraft>) => {
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, ...patch, dirty: true } : e)));
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!data) {
    return <div>릴리스를 찾을 수 없습니다.</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/releases')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          목록
        </Button>
        <h1 className="text-2xl font-bold">{data.version}</h1>
        <Badge variant={data.status === 'published' ? 'default' : 'outline'}>{data.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">릴리스 요약</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={summary}
            onChange={(e) => {
              setSummary(e.target.value);
              setSummaryDirty(true);
            }}
            placeholder="사용자에게 보여질 한 줄 요약"
            rows={2}
            maxLength={500}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              배포: {new Date(data.deployedAt).toLocaleString('ko-KR')} ·{' '}
              <code className="bg-muted px-1 rounded">{data.gitShaTo.slice(0, 7)}</code>
            </p>
            <Button
              size="sm"
              disabled={!summaryDirty || updateReleaseMutation.isPending}
              onClick={() => updateReleaseMutation.mutate({ summary: summary || null })}
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              요약 저장
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold mb-3">변경 항목 ({entries.length})</h2>
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="pt-6 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">분류</Label>
                    <Select
                      value={entry.category}
                      onValueChange={(v) => updateEntry(entry.id, { category: v as Category })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                          <SelectItem key={c} value={c}>
                            {CATEGORY_LABEL[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">범위</Label>
                    <Select
                      value={entry.scope}
                      onValueChange={(v) => updateEntry(entry.id, { scope: v as Scope })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">사용자</SelectItem>
                        <SelectItem value="internal">내부</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">제목</Label>
                  <Input
                    value={entry.title}
                    onChange={(e) => updateEntry(entry.id, { title: e.target.value })}
                    maxLength={200}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">설명</Label>
                  <Textarea
                    value={entry.description}
                    onChange={(e) => updateEntry(entry.id, { description: e.target.value })}
                    rows={2}
                    maxLength={2000}
                  />
                </div>

                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">
                    원본 커밋 ({entry.commitSha.slice(0, 7)} · {entry.authorName ?? 'unknown'})
                  </summary>
                  <pre className="mt-2 p-2 bg-muted rounded whitespace-pre-wrap">
                    {entry.originalMessage}
                  </pre>
                </details>

                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteEntryMutation.mutate(entry.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    disabled={!entry.dirty || updateEntryMutation.isPending}
                    onClick={() =>
                      updateEntryMutation.mutate({
                        id: entry.id,
                        title: entry.title,
                        description: entry.description || null,
                        category: entry.category,
                        scope: entry.scope,
                      })
                    }
                  >
                    <Save className="h-3.5 w-3.5 mr-1" />
                    저장
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {data.status === 'draft' && (
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              검토가 끝났다면 발행하여 사용자에게 노출하세요.
            </p>
            <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
              발행
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
