'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, CalendarIcon, HelpCircle, ChevronDown } from 'lucide-react';
import { format, subDays, addDays, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { ko } from 'date-fns/locale';

const DATE_PRESETS = [
  { label: '최근 7일', getDates: () => ({ start: subDays(new Date(), 7), end: new Date() }) },
  { label: '최근 14일', getDates: () => ({ start: subDays(new Date(), 14), end: new Date() }) },
  { label: '최근 30일', getDates: () => ({ start: subDays(new Date(), 30), end: new Date() }) },
  { label: '이번 주', getDates: () => ({ start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: new Date() }) },
  { label: '지난 주', getDates: () => {
    const lastWeek = subWeeks(new Date(), 1);
    return { start: startOfWeek(lastWeek, { weekStartsOn: 1 }), end: endOfWeek(lastWeek, { weekStartsOn: 1 }) };
  }},
] as const;

type SourceId = 'naver' | 'youtube' | 'dcinside' | 'fmkorea' | 'clien';

const SOURCE_OPTIONS = [
  { group: '뉴스/영상', items: [
    { id: 'naver' as SourceId, label: '네이버 뉴스' },
    { id: 'youtube' as SourceId, label: '유튜브' },
  ]},
  { group: '커뮤니티', items: [
    { id: 'dcinside' as SourceId, label: 'DC갤러리' },
    { id: 'fmkorea' as SourceId, label: '에펨코리아' },
    { id: 'clien' as SourceId, label: '클리앙' },
  ]},
];

const ALL_SOURCES: SourceId[] = ['naver', 'youtube', 'dcinside', 'fmkorea', 'clien'];

interface TriggerFormProps {
  onJobStarted: (jobId: number) => void;
}

export function TriggerForm({ onJobStarted }: TriggerFormProps) {
  const [keyword, setKeyword] = useState('');
  const [sources, setSources] = useState<SourceId[]>([...ALL_SOURCES]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [enableItemAnalysis, setEnableItemAnalysis] = useState(false);
  const [dateMode, setDateMode] = useState<'period' | 'event'>('period');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState<Date>(new Date());
  const [eventRadius, setEventRadius] = useState(3); // 전후 N일

  const triggerMutation = useMutation({
    mutationFn: (input: {
      keyword: string;
      sources: SourceId[];
      startDate: string;
      endDate: string;
      options?: { enableItemAnalysis?: boolean };
    }) => trpcClient.analysis.trigger.mutate(input),
    onSuccess: (data) => {
      toast.success('분석이 시작되었습니다');
      onJobStarted(data.jobId);
    },
    onError: () => {
      toast.error('분석 실행에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    },
  });

  const handleAllToggle = (checked: boolean) => {
    setSources(checked ? [...ALL_SOURCES] : []);
  };

  const handleSourceToggle = (source: SourceId, checked: boolean) => {
    setSources((prev) =>
      checked ? [...prev, source] : prev.filter((s) => s !== source)
    );
  };

  const isAllSelected = ALL_SOURCES.every((s) => sources.includes(s));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || sources.length === 0) return;

    // 이벤트 모드: 이벤트 날짜 전후 N일로 자동 계산
    const resolvedStart = dateMode === 'event' ? subDays(eventDate, eventRadius) : startDate;
    const resolvedEnd = dateMode === 'event' ? addDays(eventDate, eventRadius) : endDate;

    triggerMutation.mutate({
      keyword: keyword.trim(),
      sources,
      startDate: resolvedStart.toISOString(),
      endDate: resolvedEnd.toISOString(),
      options: enableItemAnalysis ? { enableItemAnalysis: true } : undefined,
    });
  };

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">분석 실행</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 키워드 입력 */}
          <div className="space-y-2">
            <Label htmlFor="keyword">키워드</Label>
            <Input
              id="keyword"
              placeholder="인물 또는 키워드 입력"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              required
              maxLength={50}
              disabled={triggerMutation.isPending}
            />
          </div>

          {/* 소스 선택 */}
          <div className="space-y-2">
            <Label>소스</Label>
            <div className="space-y-3">
              {/* 전체 선택 */}
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={(checked) => handleAllToggle(!!checked)}
                  disabled={triggerMutation.isPending}
                />
                <span className="text-sm font-medium">전체 선택</span>
              </label>
              {/* 그룹별 소스 */}
              {SOURCE_OPTIONS.map((group) => (
                <div key={group.group} className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{group.group}</p>
                  <div className="flex items-center gap-4 pl-2">
                    {group.items.map((item) => (
                      <label key={item.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={sources.includes(item.id)}
                          onCheckedChange={(checked) => handleSourceToggle(item.id, !!checked)}
                          disabled={triggerMutation.isPending}
                        />
                        <span className="text-sm">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 기간 선택 */}
          <Tabs value={dateMode} onValueChange={(v) => setDateMode(v as 'period' | 'event')}>
            <TabsList className="w-full">
              <TabsTrigger value="period" className="flex-1">기간 선택</TabsTrigger>
              <TabsTrigger value="event" className="flex-1">이벤트 중심</TabsTrigger>
            </TabsList>

            <TabsContent value="period" className="space-y-3 mt-3">
              <div className="space-y-2">
                <Label>빠른 선택</Label>
                <div className="flex flex-wrap gap-2">
                  {DATE_PRESETS.map((preset) => (
                    <Button
                      key={preset.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={triggerMutation.isPending}
                      onClick={() => {
                        const { start, end } = preset.getDates();
                        setStartDate(start);
                        setEndDate(end);
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>시작일</Label>
                  <Popover>
                    <PopoverTrigger className="inline-flex w-full items-center justify-start rounded-lg border bg-card px-3 py-2 text-sm font-normal text-foreground hover:bg-accent hover:text-accent-foreground">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(startDate, 'yyyy-MM-dd', { locale: ko })}
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => date && setStartDate(date)}
                        disabled={triggerMutation.isPending}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>종료일</Label>
                  <Popover>
                    <PopoverTrigger className="inline-flex w-full items-center justify-start rounded-lg border bg-card px-3 py-2 text-sm font-normal text-foreground hover:bg-accent hover:text-accent-foreground">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(endDate, 'yyyy-MM-dd', { locale: ko })}
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => date && setEndDate(date)}
                        disabled={triggerMutation.isPending}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="event" className="space-y-3 mt-3">
              <div className="space-y-2">
                <Label htmlFor="eventName">이벤트명</Label>
                <Input
                  id="eventName"
                  placeholder="예: 기자회견, 발언 논란, 정책 발표"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  disabled={triggerMutation.isPending}
                  maxLength={100}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>이벤트 날짜</Label>
                  <Popover>
                    <PopoverTrigger className="inline-flex w-full items-center justify-start rounded-lg border bg-card px-3 py-2 text-sm font-normal text-foreground hover:bg-accent hover:text-accent-foreground">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(eventDate, 'yyyy-MM-dd', { locale: ko })}
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={eventDate}
                        onSelect={(date) => date && setEventDate(date)}
                        disabled={triggerMutation.isPending}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eventRadius">전후 분석 범위</Label>
                  <div className="flex items-center gap-2">
                    <select
                      id="eventRadius"
                      value={eventRadius}
                      onChange={(e) => setEventRadius(Number(e.target.value))}
                      disabled={triggerMutation.isPending}
                      className="flex h-9 w-full rounded-lg border bg-card px-3 text-sm"
                    >
                      <option value={1}>전후 1일</option>
                      <option value={3}>전후 3일</option>
                      <option value={5}>전후 5일</option>
                      <option value={7}>전후 7일</option>
                    </select>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                분석 범위: {format(subDays(eventDate, eventRadius), 'MM/dd')} ~ {format(addDays(eventDate, eventRadius), 'MM/dd')}
                ({eventRadius * 2 + 1}일간)
              </p>
            </TabsContent>
          </Tabs>

          {/* 분석 옵션 */}
          <div className="space-y-2">
            <Label>분석 옵션</Label>
            <label className="flex items-start gap-2 cursor-pointer rounded-lg border p-3 hover:bg-accent/50 transition-colors">
              <Checkbox
                checked={enableItemAnalysis}
                onCheckedChange={(checked) => setEnableItemAnalysis(!!checked)}
                disabled={triggerMutation.isPending}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <span className="text-sm font-medium">개별 기사/댓글 감정 분석</span>
                <p className="text-xs text-muted-foreground">
                  각 기사와 댓글에 대해 긍정/부정/중립 감정을 개별 판정합니다. 추가 API 비용이 발생합니다.
                </p>
              </div>
            </label>
          </div>

          {/* 실행 버튼 */}
          <Button
            type="submit"
            className="w-full"
            disabled={triggerMutation.isPending || !keyword.trim() || sources.length === 0}
          >
            {triggerMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                분석 중...
              </>
            ) : (
              '분석 실행'
            )}
          </Button>

          {/* 도움말 토글 */}
          <Collapsible open={isHelpOpen} onOpenChange={setIsHelpOpen}>
            <CollapsibleTrigger
              className="w-full flex items-center justify-center gap-1 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              <HelpCircle className="h-4 w-4" />
              도움말
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${isHelpOpen ? 'rotate-180' : ''}`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 rounded-lg bg-muted/50 p-4 text-sm space-y-3">
                <div>
                  <p className="font-medium text-foreground mb-1">키워드</p>
                  <p className="text-muted-foreground">
                    분석하려는 인물명 또는 주요 키워드를 입력하세요.
                  </p>
                  <p className="text-muted-foreground mt-1">
                    예: &quot;이재명&quot;, &quot;윤석열&quot;, &quot;삼성전자&quot;, &quot;갤럭시 S25&quot;
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">소스별 특성</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• <span className="text-foreground">네이버 뉴스</span> — 뉴스 기사 본문 + 댓글 수집</li>
                    <li>• <span className="text-foreground">유튜브</span> — 관련 영상 댓글 수집</li>
                    <li>• <span className="text-foreground">커뮤니티</span> (DC갤러리/에펨코리아/클리앙) — 게시글 + 댓글 수집</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">분석 기간</p>
                  <p className="text-muted-foreground">
                    <span className="text-foreground font-medium">권장: 1~2주.</span>{' '}
                    기간이 길수록 수집 시간이 증가합니다. 이슈 발생 직전~직후 기간으로 좁히면 더 정확한 분석이 가능합니다.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">분석 프로세스</p>
                  <div className="flex items-center gap-1 text-muted-foreground flex-wrap">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">수집</span>
                    <span>→</span>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">전처리</span>
                    <span>→</span>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">AI 분석</span>
                    <span>→</span>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">리포트 생성</span>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    소스 수와 기간에 따라 수 분에서 수십 분이 소요될 수 있습니다.
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </form>
      </CardContent>
    </Card>
  );
}
