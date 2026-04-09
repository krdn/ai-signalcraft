'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { trpcClient } from '@/lib/trpc';

type Category = 'feature' | 'improvement' | 'bug' | 'other';
type Status = 'pending' | 'reviewing' | 'accepted' | 'rejected' | 'shipped';

const CATEGORY_LABEL: Record<Category, string> = {
  feature: '기능 추가',
  improvement: '개선 제안',
  bug: '버그 신고',
  other: '기타',
};

const STATUS_LABEL: Record<Status, string> = {
  pending: '검토 대기',
  reviewing: '검토 중',
  accepted: '반영 예정',
  rejected: '반려',
  shipped: '반영됨',
};

const STATUS_VARIANT: Record<Status, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending: 'outline',
  reviewing: 'secondary',
  accepted: 'default',
  rejected: 'destructive',
  shipped: 'default',
};

export default function FeedbackPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('feature');

  const { data, isLoading } = useQuery({
    queryKey: ['featureRequest', 'myList'],
    queryFn: () => trpcClient.featureRequest.myList.query({ page: 1, pageSize: 20 }),
  });

  const createMutation = useMutation({
    mutationFn: (input: { title: string; description: string; category: Category }) =>
      trpcClient.featureRequest.create.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['featureRequest', 'myList'] });
      toast.success('제안이 등록되었습니다');
      setTitle('');
      setDescription('');
      setCategory('feature');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3) {
      toast.error('제목은 3자 이상 입력해주세요');
      return;
    }
    if (description.trim().length < 10) {
      toast.error('설명은 10자 이상 입력해주세요');
      return;
    }
    createMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      category,
    });
  };

  return (
    <div className="container max-w-3xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">기능 제안 & 피드백</h1>
        <p className="text-muted-foreground mt-2">
          필요한 기능이나 개선 사항, 버그를 자유롭게 제안해주세요.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>새 제안 등록</CardTitle>
          <CardDescription>관리자가 검토 후 상태를 업데이트합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category">분류</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger id="category">
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

            <div className="space-y-2">
              <Label htmlFor="title">제목</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 분석 결과 PDF 내보내기 기능"
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">상세 설명</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="제안 배경과 기대 효과를 자세히 적어주세요"
                rows={5}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {description.length} / 2000
              </p>
            </div>

            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? '등록 중...' : '제안 등록'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">내 제안 목록</h2>

        {isLoading && (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        )}

        {!isLoading && (!data || data.items.length === 0) && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              아직 등록한 제안이 없습니다.
            </CardContent>
          </Card>
        )}

        {data?.items.map((item) => (
          <Card key={item.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(item.createdAt).toLocaleDateString('ko-KR')} ·{' '}
                    {CATEGORY_LABEL[item.category as Category]}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[item.status as Status]}>
                  {STATUS_LABEL[item.status as Status]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {item.description}
              </p>
              {item.adminNote && (
                <div className="mt-3 p-3 bg-muted rounded text-sm">
                  <p className="font-medium text-xs text-muted-foreground mb-1">관리자 답변</p>
                  <p>{item.adminNote}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
