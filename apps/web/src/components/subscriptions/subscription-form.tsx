'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, Info } from 'lucide-react';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import type { SubscriptionRecord } from '@/server/trpc/routers/subscriptions';

const SOURCE_CHOICES: { id: string; label: string }[] = [
  { id: 'naver-news', label: '네이버 뉴스' },
  { id: 'youtube', label: '유튜브' },
  { id: 'dcinside', label: 'DC인사이드' },
  { id: 'fmkorea', label: '에펨코리아' },
  { id: 'clien', label: '클리앙' },
];

type SourceId = 'naver-news' | 'youtube' | 'dcinside' | 'fmkorea' | 'clien';

type PresetId = 'quiet' | 'normal' | 'trending' | 'custom';

interface Preset {
  id: PresetId;
  label: string;
  description: string;
  intervalHours: number;
  maxPerRun: number;
}

const PRESETS: Preset[] = [
  {
    id: 'quiet',
    label: '조용한 키워드',
    description: '24시간마다 · 최대 200건',
    intervalHours: 24,
    maxPerRun: 200,
  },
  {
    id: 'normal',
    label: '일반 키워드',
    description: '6시간마다 · 최대 500건',
    intervalHours: 6,
    maxPerRun: 500,
  },
  {
    id: 'trending',
    label: '급변 키워드',
    description: '2시간마다 · 최대 300건',
    intervalHours: 2,
    maxPerRun: 300,
  },
];

function matchPreset(intervalHours: number, maxPerRun: number): PresetId {
  const found = PRESETS.find((p) => p.intervalHours === intervalHours && p.maxPerRun === maxPerRun);
  return found?.id ?? 'custom';
}

interface SubscriptionFormProps {
  initial?: SubscriptionRecord;
  onSaved?: (id: number) => void;
  /** @deprecated use onSaved */
  onCreated?: (id: number) => void;
  onCancel?: () => void;
}

export function SubscriptionForm({ initial, onSaved, onCreated, onCancel }: SubscriptionFormProps) {
  const isEdit = !!initial;

  const [keyword, setKeyword] = useState(initial?.keyword ?? '');
  const [sources, setSources] = useState<string[]>(initial?.sources ?? ['naver-news', 'youtube']);
  const [intervalHours, setIntervalHours] = useState(initial?.intervalHours ?? 6);
  const [maxPerRun, setMaxPerRun] = useState(initial?.limits?.maxPerRun ?? 500);
  const [commentsPerItem, setCommentsPerItem] = useState(initial?.limits?.commentsPerItem ?? 200);
  const [collectTranscript, setCollectTranscript] = useState(
    initial?.options?.collectTranscript ?? false,
  );

  const qc = useQueryClient();

  const notifySaved = (id: number) => {
    if (onSaved) onSaved(id);
    else if (onCreated) onCreated(id);
  };

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
        sources: input.sources as SourceId[],
        intervalHours: input.intervalHours,
        limits: input.limits,
        options: input.options,
      }),
    onSuccess: (row) => {
      toast.success('구독이 생성되었습니다');
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      if (row) notifySaved(row.id);
    },
    onError: (err) => {
      toast.error(`생성 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    },
  });

  const updateMut = useMutation({
    mutationFn: (input: {
      id: number;
      sources: string[];
      intervalHours: number;
      limits: { maxPerRun: number; commentsPerItem: number };
      options?: { collectTranscript?: boolean };
    }) =>
      trpcClient.subscriptions.update.mutate({
        id: input.id,
        sources: input.sources as SourceId[],
        intervalHours: input.intervalHours,
        limits: input.limits,
        options: input.options,
      }),
    onSuccess: (row) => {
      toast.success('구독이 수정되었습니다');
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      if (row) notifySaved(row.id);
    },
    onError: (err) => {
      toast.error(`수정 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    },
  });

  const isPending = createMut.isPending || updateMut.isPending;

  const toggleSource = (id: string, checked: boolean) => {
    setSources((prev) => (checked ? [...prev, id] : prev.filter((s) => s !== id)));
  };

  const selectedPreset = matchPreset(intervalHours, maxPerRun);

  const applyPreset = (preset: Preset) => {
    setIntervalHours(preset.intervalHours);
    setMaxPerRun(preset.maxPerRun);
  };

  const sourcesLabel = useMemo(
    () =>
      sources.map((id) => SOURCE_CHOICES.find((c) => c.id === id)?.label ?? id).join(', ') ||
      '소스 미선택',
    [sources],
  );

  // 누락 위험 추정: 시간당 허용 수집량 = maxPerRun / intervalHours
  // 한국 기준 일반 뉴스 키워드는 시간당 5~50건 수준. 시간당 허용이 2건 미만이면 위험, 5건 미만이면 주의.
  const hourlyBudget = maxPerRun / Math.max(1, intervalHours);
  const riskLevel: 'ok' | 'warn' | 'danger' =
    hourlyBudget < 2 ? 'danger' : hourlyBudget < 5 ? 'warn' : 'ok';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || sources.length === 0) {
      toast.error('키워드와 소스를 선택해 주세요');
      return;
    }
    const payload = {
      keyword: keyword.trim(),
      sources,
      intervalHours,
      limits: { maxPerRun, commentsPerItem },
      options: collectTranscript ? { collectTranscript: true } : { collectTranscript: false },
    };
    if (isEdit && initial) {
      const { keyword: _omit, ...rest } = payload;
      void _omit;
      updateMut.mutate({ id: initial.id, ...rest });
    } else {
      createMut.mutate(payload);
    }
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
          disabled={isPending || isEdit}
          required
          readOnly={isEdit}
        />
        <p className="text-xs text-muted-foreground">
          {isEdit
            ? '키워드는 변경할 수 없습니다. 다른 키워드가 필요하면 새 구독을 만들어 주세요.'
            : '등록하면 지정한 주기로 자동 수집이 시작됩니다. 분석은 별도로 실행합니다.'}
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
                disabled={isPending}
              />
              <span className="text-sm">{s.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>수집 강도 프리셋</Label>
          {selectedPreset === 'custom' && (
            <span className="text-xs text-muted-foreground">사용자 지정값</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => {
            const active = selectedPreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p)}
                disabled={isPending}
                className={cn(
                  'rounded-md border p-2 text-left transition-colors hover:bg-accent/50',
                  active && 'border-primary bg-primary/5',
                )}
              >
                <div className="text-sm font-medium">{p.label}</div>
                <div className="text-xs text-muted-foreground">{p.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sub-interval">검사 빈도 (시간)</Label>
          <Input
            id="sub-interval"
            type="number"
            min={1}
            max={168}
            value={intervalHours}
            onChange={(e) => setIntervalHours(Math.max(1, Number(e.target.value)))}
            disabled={isPending}
          />
          <p className="text-xs text-muted-foreground">얼마나 자주 새 글을 확인할지 (1~168시간)</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sub-max-per-run">한 번에 수집할 최대 개수</Label>
          <Input
            id="sub-max-per-run"
            type="number"
            min={10}
            max={2000}
            step={10}
            value={maxPerRun}
            onChange={(e) => setMaxPerRun(Math.max(10, Number(e.target.value)))}
            disabled={isPending}
          />
          <p className="text-xs text-muted-foreground">한 실행에서 소스당 가져올 상한선</p>
        </div>
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label htmlFor="sub-comments">항목당 댓글 수</Label>
          <Input
            id="sub-comments"
            type="number"
            min={0}
            max={2000}
            step={10}
            value={commentsPerItem}
            onChange={(e) => setCommentsPerItem(Math.max(0, Number(e.target.value)))}
            disabled={isPending}
          />
          <p className="text-xs text-muted-foreground">기사·영상 1건당 수집할 댓글 상한</p>
        </div>
      </div>

      {sources.includes('youtube') && (
        <label className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-accent/50">
          <Checkbox
            checked={collectTranscript}
            onCheckedChange={(checked) => setCollectTranscript(!!checked)}
            disabled={isPending}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <span className="text-sm font-medium">유튜브 자막 수집</span>
            <p className="text-xs text-muted-foreground">
              영상 자막을 수집합니다. YouTube 자막이 없는 영상은 조회수 상위 20건에 한해 오디오를
              자동 전사(Whisper)해 채웁니다. 다음 분석 실행부터 반영됩니다.
            </p>
          </div>
        </label>
      )}

      <Alert variant={riskLevel === 'danger' ? 'destructive' : 'default'}>
        {riskLevel === 'ok' ? <Info className="size-4" /> : <AlertTriangle className="size-4" />}
        <AlertDescription className="space-y-1">
          <div className="text-sm text-foreground">
            <strong>{sourcesLabel}</strong>을(를) <strong>{intervalHours}시간마다</strong> 검사해
            소스당 <strong>최대 {maxPerRun}건</strong>을 수집합니다.
          </div>
          {riskLevel === 'danger' && (
            <div className="text-xs">
              설정값이 매우 타이트합니다(시간당 {hourlyBudget.toFixed(1)}건 허용). 활발한 키워드라면
              빠르게 상한에 도달해 일부 글이 누락될 수 있습니다. 프리셋 "일반 키워드" 이상을
              권장합니다.
            </div>
          )}
          {riskLevel === 'warn' && (
            <div className="text-xs text-muted-foreground">
              시간당 {hourlyBudget.toFixed(1)}건까지 수용 가능합니다. 뉴스가 급증하는 시기에는 일부
              누락이 발생할 수 있으니 대시보드의 수집량을 확인해 주세요.
            </div>
          )}
          {riskLevel === 'ok' && (
            <div className="text-xs text-muted-foreground">
              시간당 {hourlyBudget.toFixed(1)}건까지 수용 가능합니다. 일반적인 뉴스 키워드라면
              대부분 포착됩니다.
            </div>
          )}
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
            취소
          </Button>
        )}
        <Button type="submit" disabled={isPending || !keyword.trim() || sources.length === 0}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? '변경사항 저장' : '구독 등록'}
        </Button>
      </div>
    </form>
  );
}
