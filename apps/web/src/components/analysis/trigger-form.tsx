'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Loader2, ChevronDown, Lock } from 'lucide-react';
import { format, subDays, addDays } from 'date-fns';
import { TriggerFormHelp } from './trigger-form-help';
import { DomainBadge } from './domain-badge';
import { BreakpointSection, type BreakpointValue } from './trigger-form/breakpoint-section';
import {
  type OptimizationPreset,
  type SourceId,
  OPTIMIZATION_PRESETS,
  PRESET_STYLES,
  DATE_PRESETS,
  SOURCE_OPTIONS,
  ALL_SOURCES,
} from './trigger-form-data';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface TriggerFormProps {
  onJobStarted: (jobId: number) => void;
  preset?: {
    slug: string;
    title: string;
    icon: string;
    domain: string;
    sources: Record<string, boolean>;
    customSourceIds: string[];
    limits: {
      naverArticles: number;
      youtubeVideos: number;
      communityPosts: number;
      commentsPerItem: number;
    };
    optimization:
      | 'none'
      | 'light'
      | 'standard'
      | 'aggressive'
      | 'rag-light'
      | 'rag-standard'
      | 'rag-aggressive';
    skippedModules: string[];
    enableItemAnalysis: boolean;
  } | null;
  onChangePreset?: () => void;
}

// SSR/CSR 간 동일한 초기값을 보장하기 위해 고정 날짜를 초기값으로 사용
const STABLE_INIT_DATE = new Date(0);

export function TriggerForm({ onJobStarted, preset, onChangePreset }: TriggerFormProps) {
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const isDemo = userRole === 'demo';

  // 데모 쿼터 조회
  const { data: demoQuota } = useQuery({
    queryKey: ['demoAuth', 'quota'],
    queryFn: () => trpcClient.demoAuth.getQuota.query(),
    enabled: isDemo,
  });

  const [keyword, setKeyword] = useState('');
  const [sources, setSources] = useState<SourceId[]>([...ALL_SOURCES]);
  const [customSourceIds, setCustomSourceIds] = useState<string[]>([]);

  // 관리자가 /admin/sources에서 등록한 동적 소스 (RSS/HTML)
  const { data: customSources } = useQuery({
    queryKey: ['sources', 'enabled'],
    queryFn: () => trpcClient.admin.sources.listEnabled.query(),
    staleTime: 60 * 1000,
  });
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpTab, setHelpTab] = useState('quickstart');
  const [startDate, setStartDate] = useState<Date>(STABLE_INIT_DATE);
  const [endDate, setEndDate] = useState<Date>(STABLE_INIT_DATE);
  const [enableItemAnalysis, setEnableItemAnalysis] = useState(isDemo);
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
  const [optimizationPreset, setOptimizationPreset] = useState<OptimizationPreset>('rag_standard');
  const [breakpoints, setBreakpoints] = useState<BreakpointValue[]>([]);

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

  // 프리셋 기본값 적용
  useEffect(() => {
    if (!preset) return;
    const enabledSources = Object.entries(preset.sources)
      .filter(([, v]) => v)
      .map(([k]) => k) as SourceId[];
    setSources(enabledSources);
    setCustomSourceIds(preset.customSourceIds);
    setMaxNaverArticles(preset.limits.naverArticles);
    setMaxYoutubeVideos(preset.limits.youtubeVideos);
    setMaxCommunityPosts(preset.limits.communityPosts);
    setMaxCommentsPerItem(preset.limits.commentsPerItem);
    setOptimizationPreset(preset.optimization);
    setEnableItemAnalysis(preset.enableItemAnalysis);
  }, [preset]);

  const triggerMutation = useMutation({
    mutationFn: (input: {
      keyword: string;
      keywordType?: string;
      domain?: string;
      sources: SourceId[];
      customSourceIds?: string[];
      startDate: string;
      endDate: string;
      options?: { enableItemAnalysis?: boolean; tokenOptimization?: OptimizationPreset };
      limits?: {
        naverArticles: number;
        youtubeVideos: number;
        communityPosts: number;
        commentsPerItem: number;
      };
      breakpoints?: BreakpointValue[];
    }) => trpcClient.analysis.trigger.mutate(input as any),
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

  const handleCustomSourceToggle = (id: string, checked: boolean) => {
    setCustomSourceIds((prev) => (checked ? [...prev, id] : prev.filter((v) => v !== id)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || (sources.length === 0 && customSourceIds.length === 0)) return;

    // 이벤트 모드: 이벤트 날짜 전후 N일로 자동 계산
    const resolvedStart = dateMode === 'event' ? subDays(eventDate, eventRadius) : startDate;
    const resolvedEnd = dateMode === 'event' ? addDays(eventDate, eventRadius) : endDate;

    triggerMutation.mutate({
      keyword: keyword.trim(),
      ...(preset?.slug && { keywordType: preset.slug }),
      ...(preset?.domain && { domain: preset.domain as any }),
      sources,
      customSourceIds: customSourceIds.length > 0 ? customSourceIds : undefined,
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
      breakpoints: breakpoints.length > 0 ? breakpoints : undefined,
    });
  };

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">분석 실행</CardTitle>
      </CardHeader>
      <CardContent>
        {/* 데모 사용자 쿼터 정보 */}
        {isDemo && demoQuota && (
          <div className="mb-4 rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-primary">무료 체험 중</span>
              <span className="text-xs text-muted-foreground">
                {demoQuota.isExpired ? '만료됨' : `${demoQuota.daysLeft}일 남음`}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-background p-2">
                <div className="text-lg font-bold text-primary">{demoQuota.todayRemaining}</div>
                <div className="text-[10px] text-muted-foreground">오늘 남은 횟수</div>
              </div>
              <div className="rounded-md bg-background p-2">
                <div className="text-lg font-bold">{demoQuota.dailyLimit}</div>
                <div className="text-[10px] text-muted-foreground">일일 한도</div>
              </div>
              <div className="rounded-md bg-background p-2">
                <div className="text-lg font-bold">
                  {demoQuota.daysLeft}
                  <span className="text-xs font-normal">일</span>
                </div>
                <div className="text-[10px] text-muted-foreground">잔여 기간</div>
              </div>
            </div>
            {(demoQuota.todayRemaining <= 0 || demoQuota.isExpired) && (
              <p className="text-xs text-destructive">
                {demoQuota.isExpired
                  ? '체험 기간이 만료되었습니다.'
                  : '오늘 분석 횟수를 모두 사용했습니다. 내일 다시 이용 가능합니다.'}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">
              누적 {demoQuota.totalUsed}회 사용 · 핵심 분석 모듈 3개 · 수집 한도 축소 적용
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 선택된 프리셋 표시 */}
          {preset && onChangePreset && (
            <div className="flex items-center justify-between rounded-lg border bg-primary/5 border-primary/20 p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-primary">{preset.title}</span>
                <span className="text-xs text-muted-foreground">프리셋 적용됨</span>
              </div>
              <div className="flex items-center gap-2">
                {preset.domain && <DomainBadge domain={preset.domain} size="sm" />}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={onChangePreset}
                >
                  유형 변경
                </Button>
              </div>
            </div>
          )}

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
              {/* 사용자 정의 소스 (관리자가 /admin/sources에서 등록한 RSS/HTML) */}
              {customSources && customSources.length > 0 && !isDemo && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">사용자 정의 소스</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-2">
                    {customSources.map((cs) => (
                      <label key={cs.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={customSourceIds.includes(cs.id)}
                          onCheckedChange={(checked) => handleCustomSourceToggle(cs.id, !!checked)}
                          disabled={triggerMutation.isPending}
                        />
                        <span className="text-sm">
                          {cs.name}
                          <span className="ml-1 text-[10px] text-muted-foreground uppercase">
                            {cs.adapterType}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 기간 선택 */}
          {isDemo && (
            <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 text-sm text-muted-foreground flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0" />
              기간: 최근 7일 고정 (데모 체험)
            </div>
          )}
          <Tabs
            value={dateMode}
            onValueChange={(v) => !isDemo && setDateMode(v as 'period' | 'event')}
            className={isDemo ? 'hidden' : ''}
          >
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
            <label
              suppressHydrationWarning
              className={`flex items-start gap-2 rounded-lg border p-3 transition-colors ${isDemo ? 'opacity-70' : 'cursor-pointer hover:bg-accent/50'}`}
            >
              <Checkbox
                checked={enableItemAnalysis}
                onCheckedChange={(checked) => setEnableItemAnalysis(!!checked)}
                disabled={isDemo || triggerMutation.isPending}
                className="mt-0.5"
              />
              <div className="space-y-1" suppressHydrationWarning>
                <span className="text-sm font-medium" suppressHydrationWarning>
                  개별 기사/댓글 감정 분석
                  {isDemo && (
                    <span className="ml-2 text-xs text-primary font-normal">(데모 기본 포함)</span>
                  )}
                </span>
                <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                  각 기사와 댓글에 대해 긍정/부정/중립 감정을 개별 판정합니다.
                  {!isDemo && ' 추가 API 비용이 발생합니다.'}
                </p>
              </div>
            </label>
          </div>

          {/* 수집 한도 설정 — 데모 사용자는 변경 불가 */}
          {isDemo && (
            <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 text-sm text-muted-foreground flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0" />
              수집 한도 & 토큰 최적화: 데모 기본값 적용 (변경 불가)
            </div>
          )}
          <Collapsible
            open={isLimitsOpen}
            onOpenChange={setIsLimitsOpen}
            className={isDemo ? 'hidden' : ''}
          >
            <CollapsibleTrigger className="w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-accent transition-colors cursor-pointer">
              <div className="flex items-center gap-2">
                <span className="font-medium">수집 한도 & 토큰 최적화</span>
                {optimizationPreset !== 'none' && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PRESET_STYLES[optimizationPreset]?.indicator ?? 'bg-zinc-500/15 text-zinc-500'}`}
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
                  {/* 기존 모드 */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {(
                      Object.entries(OPTIMIZATION_PRESETS).filter(
                        ([, p]) => p.group === 'classic',
                      ) as [OptimizationPreset, (typeof OPTIMIZATION_PRESETS)[OptimizationPreset]][]
                    ).map(([key, preset]) => {
                      const style = PRESET_STYLES[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setOptimizationPreset(key)}
                          disabled={triggerMutation.isPending}
                          className={`rounded-md border p-2 text-center transition-colors ${
                            optimizationPreset === key
                              ? `${style?.border ?? 'border-zinc-500'} ${style?.bg ?? 'bg-zinc-500/10'}`
                              : 'border-border hover:bg-accent'
                          }`}
                        >
                          <div
                            className={`text-xs font-medium ${
                              optimizationPreset === key
                                ? (style?.text ?? 'text-zinc-400')
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
                      );
                    })}
                  </div>
                  {/* RAG 모드 */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      Object.entries(OPTIMIZATION_PRESETS).filter(([, p]) => p.group === 'rag') as [
                        OptimizationPreset,
                        (typeof OPTIMIZATION_PRESETS)[OptimizationPreset],
                      ][]
                    ).map(([key, preset]) => {
                      const style = PRESET_STYLES[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setOptimizationPreset(key)}
                          disabled={triggerMutation.isPending}
                          className={`rounded-md border p-2 text-center transition-colors ${
                            optimizationPreset === key
                              ? `${style?.border} ${style?.bg}`
                              : 'border-border hover:bg-accent'
                          }`}
                        >
                          <div
                            className={`text-xs font-medium ${
                              optimizationPreset === key ? style?.text : 'text-muted-foreground'
                            }`}
                          >
                            {preset.label}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {preset.estimatedReduction}↓
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    RAG 모드는 DB에 저장된 임베딩을 활용하여 의미 관련 문서만 선별합니다.
                  </p>
                  {optimizationPreset !== 'none' && (
                    <div
                      className={`rounded-md p-2 text-xs border-l-2 ${
                        PRESET_STYLES[optimizationPreset]?.border?.replace(
                          'border-',
                          'border-l-',
                        ) ?? 'border-l-zinc-500'
                      } ${
                        PRESET_STYLES[optimizationPreset]?.bg?.replace('/10', '/5') ??
                        'bg-zinc-500/5'
                      }`}
                    >
                      {OPTIMIZATION_PRESETS[optimizationPreset].description}
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* 단계별 검수 정지 — 데모 사용자는 표시하지 않음 */}
          {!isDemo && <BreakpointSection value={breakpoints} onChange={setBreakpoints} />}

          {/* 실행 버튼 */}
          <Button
            type="submit"
            className="w-full"
            disabled={
              triggerMutation.isPending ||
              !keyword.trim() ||
              (sources.length === 0 && customSourceIds.length === 0)
            }
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
