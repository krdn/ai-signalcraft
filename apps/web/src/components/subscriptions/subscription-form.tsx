'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

const SOURCE_CHOICES: { id: string; label: string }[] = [
  { id: 'naver-news', label: '네이버 뉴스' },
  { id: 'youtube', label: '유튜브' },
  { id: 'dcinside', label: 'DC인사이드' },
  { id: 'fmkorea', label: '에펨코리아' },
  { id: 'clien', label: '클리앙' },
];

interface SubscriptionFormProps {
  onCreated?: (id: number) => void;
  onCancel?: () => void;
}

export function SubscriptionForm({ onCreated, onCancel }: SubscriptionFormProps) {
  const [keyword, setKeyword] = useState('');
  const [sources, setSources] = useState<string[]>(['naver-news', 'youtube']);
  const [intervalHours, setIntervalHours] = useState(6);
  const [maxPerRun, setMaxPerRun] = useState(100);
  const [commentsPerItem, setCommentsPerItem] = useState(200);
  const [collectTranscript, setCollectTranscript] = useState(false);

  const qc = useQueryClient();

  const createMut = useMutation({
    mutationFn: (input: {
      keyword: string;
      sources: string[];
      intervalHours: number;
      limits: { maxPerRun: number; commentsPerItem: number };
      options?: { collectTranscript?: boolean };
    }) =>
      trpcClient.subscriptions.create.mutate({
        keyword: input.keyword,
        sources: input.sources as ('naver-news' | 'youtube' | 'dcinside' | 'fmkorea' | 'clien')[],
        intervalHours: input.intervalHours,
        limits: input.limits,
        options: input.options,
      }),
    onSuccess: (row) => {
      toast.success('구독이 생성되었습니다');
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      if (row && onCreated) onCreated(row.id);
    },
    onError: (err) => {
      toast.error(`생성 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    },
  });

  const toggleSource = (id: string, checked: boolean) => {
    setSources((prev) => (checked ? [...prev, id] : prev.filter((s) => s !== id)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || sources.length === 0) {
      toast.error('키워드와 소스를 선택해 주세요');
      return;
    }
    createMut.mutate({
      keyword: keyword.trim(),
      sources,
      intervalHours,
      limits: { maxPerRun, commentsPerItem },
      options: collectTranscript ? { collectTranscript: true } : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sub-keyword">키워드</Label>
        <Input
          id="sub-keyword"
          placeholder="예: 이재명, 삼성전자, 한동훈"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          maxLength={200}
          disabled={createMut.isPending}
          required
        />
        <p className="text-xs text-muted-foreground">
          등록하면 지정한 주기로 자동 수집이 시작됩니다. 분석은 별도로 실행합니다.
        </p>
      </div>

      <div className="space-y-2">
        <Label>수집 소스</Label>
        <div className="grid grid-cols-2 gap-2">
          {SOURCE_CHOICES.map((s) => (
            <label
              key={s.id}
              className="flex items-center gap-2 cursor-pointer rounded-md border p-2 hover:bg-accent/50"
            >
              <Checkbox
                checked={sources.includes(s.id)}
                onCheckedChange={(checked) => toggleSource(s.id, !!checked)}
                disabled={createMut.isPending}
              />
              <span className="text-sm">{s.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sub-interval">수집 주기 (시간)</Label>
          <Input
            id="sub-interval"
            type="number"
            min={1}
            max={168}
            value={intervalHours}
            onChange={(e) => setIntervalHours(Math.max(1, Number(e.target.value)))}
            disabled={createMut.isPending}
          />
          <p className="text-xs text-muted-foreground">1시간 ~ 7일(168시간)</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sub-max-per-run">실행당 최대 수집</Label>
          <Input
            id="sub-max-per-run"
            type="number"
            min={10}
            max={2000}
            step={10}
            value={maxPerRun}
            onChange={(e) => setMaxPerRun(Math.max(10, Number(e.target.value)))}
            disabled={createMut.isPending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sub-comments">항목당 댓글 수</Label>
          <Input
            id="sub-comments"
            type="number"
            min={0}
            max={2000}
            step={10}
            value={commentsPerItem}
            onChange={(e) => setCommentsPerItem(Math.max(0, Number(e.target.value)))}
            disabled={createMut.isPending}
          />
        </div>
      </div>

      {sources.includes('youtube') && (
        <label className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-accent/50">
          <Checkbox
            checked={collectTranscript}
            onCheckedChange={(checked) => setCollectTranscript(!!checked)}
            disabled={createMut.isPending}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <span className="text-sm font-medium">유튜브 자막 수집</span>
            <p className="text-xs text-muted-foreground">
              영상 자막(자동 생성 포함)을 함께 수집. 자막 없으면 건너뜁니다.
            </p>
          </div>
        </label>
      )}

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={createMut.isPending}>
            취소
          </Button>
        )}
        <Button
          type="submit"
          disabled={createMut.isPending || !keyword.trim() || sources.length === 0}
        >
          {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          구독 등록
        </Button>
      </div>
    </form>
  );
}
