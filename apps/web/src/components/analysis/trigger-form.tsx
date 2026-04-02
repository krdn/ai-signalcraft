'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, ChevronDown } from 'lucide-react';
import { format, subDays, addDays, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { OPTIMIZATION_PRESETS, type OptimizationPreset } from '@ai-signalcraft/core';
import { TriggerFormHelp } from './trigger-form-help';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const DATE_PRESETS = [
  { label: '최근 7일', getDates: () => ({ start: subDays(new Date(), 7), end: new Date() }) },
  { label: '최근 14일', getDates: () => ({ start: subDays(new Date(), 14), end: new Date() }) },
  { label: '최근 30일', getDates: () => ({ start: subDays(new Date(), 30), end: new Date() }) },
  {
    label: '이번 주',
    getDates: () => ({ start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: new Date() }),
  },
  {
    label: '지난 주',
    getDates: () => {
      const lastWeek = subWeeks(new Date(), 1);
      return {
        start: startOfWeek(lastWeek, { weekStartsOn: 1 }),
        end: endOfWeek(lastWeek, { weekStartsOn: 1 }),
      };
    },
  },
] as const;

type SourceId = 'naver' | 'youtube' | 'dcinside' | 'fmkorea' | 'clien';

const SOURCE_OPTIONS = [
  {
    group: '뉴스/영상',
    items: [
      { id: 'naver' as SourceId, label: '네이버 뉴스' },
      { id: 'youtube' as SourceId, label: '유튜브' },
    ],
  },
  {
    group: '커뮤니티',
    items: [
      { id: 'dcinside' as SourceId, label: 'DC갤러리' },
      { id: 'fmkorea' as SourceId, label: '에펨코리아' },
      { id: 'clien' as SourceId, label: '클리앙' },
    ],
  },
];

const ALL_SOURCES: SourceId[] = ['naver', 'youtube', 'dcinside', 'fmkorea', 'clien'];

interface TriggerFormProps {
  onJobStarted: (jobId: number) => void;
}

// SSR/CSR 간 동일한 초기값을 보장하기 위해 고정 날짜를 초기값으로 사용
const STABLE_INIT_DATE = new Date(0);

export function TriggerForm({ onJobStarted }: TriggerFormProps) {
  const [keyword, setKeyword] = useState('');
  const [sources, setSources] = useState<SourceId[]>([...ALL_SOURCES]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpTab, setHelpTab] = useState('quickstart');
  const [startDate, setStartDate] = useState<Date>(STABLE_INIT_DATE);
  const [endDate, setEndDate] = useState<Date>(STABLE_INIT_DATE);
  const [enableItemAnalysis, setEnableItemAnalysis] = useState(false);
  const [dateMode, setDateMode] = useState<'period' | 'event'>('period');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState<Date>(STABLE_INIT_DATE);
  const [eventRadius, setEventRadius] = useState(3); // 전후 N일
  const [isLimitsOpen, setIsLimitsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [maxNaverArticles, setMaxNaverArticles] = useState(500);
  const [maxYoutubeVideos, setMaxYoutubeVideos] = useState(50);
  const [maxCommunityPosts, setMaxCommunityPosts] = useState(50);
  const [maxCommentsPerItem, setMaxCommentsPerItem] = useState(500);
  const [optimizationPreset, setOptimizationPreset] = useState<OptimizationPreset>('none');

  // 클라이언트 마운트 후 실제 날짜 설정 (hydration mismatch 방지)
  useEffect(() => {
    const now = new Date();
    setStartDate(subDays(now, 7));
    setEndDate(now);
    setEventDate(now);
    setIsMounted(true);
  }, []);

  // 서버에서 수집 한도 기본값 로드
  const { data: defaultLimits } = useQuery({
    queryKey: ['settings', 'collectionLimits'],
    queryFn: () => trpcClient.settings.collectionLimits.get.query(),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (defaultLimits) {
      setMaxNaverArticles(defaultLimits.naverArticles);
      setMaxYoutubeVideos(defaultLimits.youtubeVideos);
      setMaxCommunityPosts(defaultLimits.communityPosts);
      setMaxCommentsPerItem(defaultLimits.commentsPerItem);
    }
  }, [defaultLimits]);

  const triggerMutation = useMutation({
    mutationFn: (input: {
      keyword: string;
      sources: SourceId[];
      startDate: string;
      endDate: string;
      options?: { enableItemAnalysis?: boolean; tokenOptimization?: OptimizationPreset };
      limits?: {
        naverArticles: number;
        youtubeVideos: number;
        communityPosts: number;
        commentsPerItem: number;
      };
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
    setSources((prev) => (checked ? [...prev, source] : prev.filter((s) => s !== source)));
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
      options:
        enableItemAnalysis || optimizationPreset !== 'none'
          ? {
              ...(enableItemAnalysis && { enableItemAnalysis: true }),
              ...(optimizationPreset !== 'none' && { tokenOptimization: optimizationPreset }),
            }
          : undefined,
      limits: {
        naverArticles: maxNaverArticles,
        youtubeVideos: maxYoutubeVideos,
        communityPosts: maxCommunityPosts,
        commentsPerItem: maxCommentsPerItem,
      },
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
              <TabsTrigger value="period" className="flex-1">
                기간 선택
              </TabsTrigger>
              <TabsTrigger value="event" className="flex-1">
                이벤트 중심
              </TabsTrigger>
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
                  <input
                    type="date"
                    className="flex h-9 w-full rounded-lg border bg-card px-3 text-sm"
                    value={isMounted ? format(startDate, 'yyyy-MM-dd') : ''}
                    onChange={(e) => e.target.value && setStartDate(new Date(e.target.value))}
                    disabled={triggerMutation.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>종료일</Label>
                  <input
                    type="date"
                    className="flex h-9 w-full rounded-lg border bg-card px-3 text-sm"
                    value={isMounted ? format(endDate, 'yyyy-MM-dd') : ''}
                    onChange={(e) => e.target.value && setEndDate(new Date(e.target.value))}
                    disabled={triggerMutation.isPending}
                  />
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
                  <input
                    type="date"
                    className="flex h-9 w-full rounded-lg border bg-card px-3 text-sm"
                    value={isMounted ? format(eventDate, 'yyyy-MM-dd') : ''}
                    onChange={(e) => e.target.value && setEventDate(new Date(e.target.value))}
                    disabled={triggerMutation.isPending}
                  />
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
              <p suppressHydrationWarning className="text-xs text-muted-foreground">
                {isMounted
                  ? `분석 범위: ${format(subDays(eventDate, eventRadius), 'MM/dd')} ~ ${format(addDays(eventDate, eventRadius), 'MM/dd')} (${eventRadius * 2 + 1}일간)`
                  : '분석 범위: --/-- ~ --/-- (7일간)'}
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
                  각 기사와 댓글에 대해 긍정/부정/중립 감정을 개별 판정합니다. 추가 API 비용이
                  발생합니다.
                </p>
              </div>
            </label>
          </div>

          {/* 수집 한도 설정 */}
          <Collapsible open={isLimitsOpen} onOpenChange={setIsLimitsOpen}>
            <CollapsibleTrigger className="w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-accent transition-colors cursor-pointer">
              <div className="flex items-center gap-2">
                <span className="font-medium">수집 한도 & 토큰 최적화</span>
                {optimizationPreset !== 'none' && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      optimizationPreset === 'light'
                        ? 'bg-green-500/15 text-green-500'
                        : optimizationPreset === 'standard'
                          ? 'bg-yellow-500/15 text-yellow-500'
                          : 'bg-orange-500/15 text-orange-500'
                    }`}
                  >
                    {OPTIMIZATION_PRESETS[optimizationPreset].label}{' '}
                    {OPTIMIZATION_PRESETS[optimizationPreset].estimatedReduction}↓
                  </span>
                )}
              </div>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isLimitsOpen ? 'rotate-180' : ''}`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-3 rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">
                  소스별 최대 수집 건수를 조절합니다. 줄이면 비용과 시간이 절약됩니다.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="maxNaver" className="text-xs">
                      네이버 뉴스
                    </Label>
                    <Input
                      id="maxNaver"
                      type="number"
                      min={10}
                      max={5000}
                      step={10}
                      value={maxNaverArticles}
                      onChange={(e) => setMaxNaverArticles(Number(e.target.value))}
                      disabled={triggerMutation.isPending}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="maxYoutube" className="text-xs">
                      유튜브 영상
                    </Label>
                    <Input
                      id="maxYoutube"
                      type="number"
                      min={5}
                      max={500}
                      step={5}
                      value={maxYoutubeVideos}
                      onChange={(e) => setMaxYoutubeVideos(Number(e.target.value))}
                      disabled={triggerMutation.isPending}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="maxCommunity" className="text-xs">
                      커뮤니티 게시글
                    </Label>
                    <Input
                      id="maxCommunity"
                      type="number"
                      min={5}
                      max={500}
                      step={5}
                      value={maxCommunityPosts}
                      onChange={(e) => setMaxCommunityPosts(Number(e.target.value))}
                      disabled={triggerMutation.isPending}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="maxComments" className="text-xs">
                      항목당 댓글
                    </Label>
                    <Input
                      id="maxComments"
                      type="number"
                      min={10}
                      max={2000}
                      step={10}
                      value={maxCommentsPerItem}
                      onChange={(e) => setMaxCommentsPerItem(Number(e.target.value))}
                      disabled={triggerMutation.isPending}
                    />
                  </div>
                </div>

                {/* 구분선 */}
                <div className="border-t my-1" />

                {/* 토큰 최적화 프리셋 */}
                <div className="space-y-2">
                  <Label className="text-xs">토큰 최적화</Label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(
                      Object.entries(OPTIMIZATION_PRESETS) as [
                        OptimizationPreset,
                        (typeof OPTIMIZATION_PRESETS)[OptimizationPreset],
                      ][]
                    ).map(([key, preset]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setOptimizationPreset(key)}
                        disabled={triggerMutation.isPending}
                        className={`rounded-md border p-2 text-center transition-colors ${
                          optimizationPreset === key
                            ? key === 'none'
                              ? 'border-zinc-500 bg-zinc-500/10'
                              : key === 'light'
                                ? 'border-green-500 bg-green-500/10'
                                : key === 'standard'
                                  ? 'border-yellow-500 bg-yellow-500/10'
                                  : 'border-orange-500 bg-orange-500/10'
                            : 'border-border hover:bg-accent'
                        }`}
                      >
                        <div
                          className={`text-xs font-medium ${
                            optimizationPreset === key
                              ? key === 'none'
                                ? 'text-zinc-400'
                                : key === 'light'
                                  ? 'text-green-500'
                                  : key === 'standard'
                                    ? 'text-yellow-500'
                                    : 'text-orange-500'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {preset.label}
                        </div>
                        {key !== 'none' && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {preset.estimatedReduction}↓
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  {optimizationPreset !== 'none' && (
                    <div
                      className={`rounded-md p-2 text-xs border-l-2 ${
                        optimizationPreset === 'light'
                          ? 'border-l-green-500 bg-green-500/5 text-green-200'
                          : optimizationPreset === 'standard'
                            ? 'border-l-yellow-500 bg-yellow-500/5 text-yellow-200'
                            : 'border-l-orange-500 bg-orange-500/5 text-orange-200'
                      }`}
                    >
                      {OPTIMIZATION_PRESETS[optimizationPreset].description}
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

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
          <TriggerFormHelp
            isHelpOpen={isHelpOpen}
            setIsHelpOpen={setIsHelpOpen}
            helpTab={helpTab}
            setHelpTab={setHelpTab}
          />
        </form>
      </CardContent>
    </Card>
  );
}
