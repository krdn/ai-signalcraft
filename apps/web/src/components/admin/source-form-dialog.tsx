'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, TestTube2, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { trpcClient } from '@/lib/trpc';

type AdapterType = 'rss' | 'html';

interface Selectors {
  item: string;
  title: string;
  link: string;
  body?: string;
  date?: string;
}

interface SamplePreviewItem {
  title?: string;
  url?: string;
  content?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SourceFormDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [adapterType, setAdapterType] = useState<AdapterType>('rss');
  const [defaultLimit, setDefaultLimit] = useState(50);
  const [selectors, setSelectors] = useState<Selectors>({
    item: '',
    title: '',
    link: '',
    body: '',
    date: '',
  });
  const [samples, setSamples] = useState<SamplePreviewItem[] | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // 다이얼로그가 닫힐 때 상태 초기화
  useEffect(() => {
    if (!open) {
      setName('');
      setUrl('');
      setAdapterType('rss');
      setDefaultLimit(50);
      setSelectors({ item: '', title: '', link: '', body: '', date: '' });
      setSamples(null);
      setTestError(null);
    }
  }, [open]);

  const detectMutation = useMutation({
    mutationFn: (u: string) => trpcClient.admin.sources.detectType.mutate({ url: u }),
    onSuccess: (data) => setAdapterType(data.adapterType),
  });

  const testMutation = useMutation({
    mutationFn: () =>
      trpcClient.admin.sources.test.mutate({
        adapterType,
        url,
        config: adapterType === 'html' ? { selectors } : null,
      }),
    onSuccess: (data) => {
      if (data.ok) {
        setSamples(data.items as SamplePreviewItem[]);
        setTestError(null);
        toast.success(`테스트 성공 — ${data.count}건 수집`);
      } else {
        setSamples([]);
        setTestError(data.error);
        toast.error(`테스트 실패: ${data.error}`);
      }
    },
    onError: (err: Error) => {
      setSamples([]);
      setTestError(err.message);
      toast.error(err.message);
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      trpcClient.admin.sources.create.mutate({
        name,
        adapterType,
        url,
        config: adapterType === 'html' ? { selectors } : null,
        defaultLimit,
      }),
    onSuccess: () => {
      toast.success('데이터 소스가 추가되었습니다.');
      qc.invalidateQueries({ queryKey: ['admin', 'sources'] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSave =
    name.trim().length > 0 &&
    url.trim().length > 0 &&
    (adapterType !== 'html' ||
      (selectors.item.trim() && selectors.title.trim() && selectors.link.trim()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>데이터 소스 추가</DialogTitle>
          <DialogDescription>
            RSS 피드 또는 HTML 목록 페이지 URL을 입력하면 수집 대상에 자동 등록됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="name">표시명</Label>
            <Input
              id="name"
              placeholder="예: 한겨레 RSS"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="url">URL</Label>
            <div className="flex gap-2">
              <Input
                id="url"
                placeholder="https://www.hani.co.kr/rss/"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!url || detectMutation.isPending}
                onClick={() => detectMutation.mutate(url)}
              >
                {detectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                타입 감지
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="adapterType">어댑터 타입</Label>
            <Select value={adapterType} onValueChange={(v) => setAdapterType(v as AdapterType)}>
              <SelectTrigger id="adapterType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rss">RSS / Atom 피드</SelectItem>
                <SelectItem value="html">HTML 목록 페이지</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="limit">1회 수집 최대 건수</Label>
            <Input
              id="limit"
              type="number"
              min={1}
              max={500}
              value={defaultLimit}
              onChange={(e) => setDefaultLimit(Number(e.target.value) || 50)}
            />
          </div>

          {adapterType === 'html' && (
            <div className="grid gap-2 rounded-md border bg-muted/30 p-3">
              <div className="text-sm font-medium">CSS 셀렉터</div>
              <div className="text-xs text-muted-foreground">
                정적 HTML 목록 페이지에서 각 항목을 추출할 셀렉터를 입력하세요.
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label htmlFor="sel-item" className="text-xs">
                    item (컨테이너) *
                  </Label>
                  <Input
                    id="sel-item"
                    placeholder="article.post"
                    value={selectors.item}
                    onChange={(e) => setSelectors({ ...selectors, item: e.target.value })}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="sel-title" className="text-xs">
                    title *
                  </Label>
                  <Input
                    id="sel-title"
                    placeholder="h2.title"
                    value={selectors.title}
                    onChange={(e) => setSelectors({ ...selectors, title: e.target.value })}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="sel-link" className="text-xs">
                    link (href) *
                  </Label>
                  <Input
                    id="sel-link"
                    placeholder="a.permalink"
                    value={selectors.link}
                    onChange={(e) => setSelectors({ ...selectors, link: e.target.value })}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="sel-body" className="text-xs">
                    body (선택)
                  </Label>
                  <Input
                    id="sel-body"
                    placeholder="div.summary"
                    value={selectors.body ?? ''}
                    onChange={(e) => setSelectors({ ...selectors, body: e.target.value })}
                  />
                </div>
                <div className="grid gap-1 col-span-2">
                  <Label htmlFor="sel-date" className="text-xs">
                    date (선택)
                  </Label>
                  <Input
                    id="sel-date"
                    placeholder="time.date"
                    value={selectors.date ?? ''}
                    onChange={(e) => setSelectors({ ...selectors, date: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!url || testMutation.isPending}
              onClick={() => testMutation.mutate()}
            >
              {testMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <TestTube2 className="h-4 w-4 mr-1" />
              )}
              테스트 수집 (샘플 5건)
            </Button>
          </div>

          {testError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {testError}
            </div>
          )}

          {samples && samples.length > 0 && (
            <div className="grid gap-2 rounded-md border bg-muted/20 p-3">
              <div className="text-sm font-medium">미리보기 — {samples.length}건</div>
              <ul className="grid gap-1.5 max-h-52 overflow-y-auto text-xs">
                {samples.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0">
                      {i + 1}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{s.title ?? '(제목 없음)'}</div>
                      {s.url && <div className="text-muted-foreground truncate">{s.url}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!canSave || createMutation.isPending}
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
