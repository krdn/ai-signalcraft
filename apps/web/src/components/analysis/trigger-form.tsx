'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Loader2, ChevronDown, Lock, HelpCircle, RefreshCw } from 'lucide-react';
import { format, subDays, addDays } from 'date-fns';
import { TriggerFormHelp } from './trigger-form-help';
import { DomainBadge } from './domain-badge';
import { BreakpointSection, type BreakpointValue } from './trigger-form/breakpoint-section';
import { SeriesSelector } from './trigger-form/series-selector';
import {
  type OptimizationPreset,
  type SourceId,
  OPTIMIZATION_PRESETS,
  PRESET_STYLES,
  DATE_PRESETS,
  SOURCE_OPTIONS,
  ALL_SOURCES,
} from './trigger-form-data';
import { SubscriptionPicker, type SubscriptionSummary } from './subscription-picker';
import { OrphanJobsDialog } from './trigger-form/orphan-jobs-dialog';
import { DemoQuotaBadge } from './trigger-form/demo-quota-badge';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

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
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null);
  const [createNewSeries, setCreateNewSeries] = useState(false);

  const handleSeriesSelect = useCallback((seriesId: number | null, createNew: boolean) => {
    setSelectedSeriesId(seriesId);
    setCreateNewSeries(createNew);
  }, []);

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
  const [enableItemAnalysis, setEnableItemAnalysis] = useState(true);
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
  const [optimizationPreset, setOptimizationPreset] = useState<OptimizationPreset>('rag-standard');
  const [breakpoints, setBreakpoints] = useState<BreakpointValue[]>([]);
  const [forceRefetch, setForceRefetch] = useState(false);
  const [collectTranscript, setCollectTranscript] = useState(false);
  const [subscriptionMode, setSubscriptionMode] = useState<{
    isActive: boolean;
    subscription: SubscriptionSummary | null;
  }>({ isActive: false, subscription: null });

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

  // 프리셋 기본값 적용.
  // 참고: 기간 모드(dateMode === 'period')에서는 이 값들이 '날짜별 한도'로 해석되고
  // 이벤트 중심 모드에서는 '총량'으로 해석됨. 프리셋 자체는 모드를 구분하지 않음.
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
    setEnableItemAnalysis(true);
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
      limitMode?: 'perDay' | 'total';
      breakpoints?: BreakpointValue[];
      forceRefetch?: boolean;
    }) => trpcClient.analysis.trigger.mutate(input as any),
    onSuccess: (data) => {
      toast.success('분석이 시작되었습니다');
      onJobStarted(data.jobId);
    },
    onError: () => {
      toast.error('분석 실행에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    },
  });

  // 고아 작업 확인 다이얼로그 상태
  const [orphanDialog, setOrphanDialog] = useState<{
    open: boolean;
    count: number;
    pendingSubmit: (() => void) | null;
  }>({ open: false, count: 0, pendingSubmit: null });

  const cleanupMutation = useMutation({
    mutationFn: () => trpcClient.admin.workerMgmt.cleanupOrphanedJobs.mutate(),
    onSuccess: (res) => {
      toast.success(`${res.cleaned}개 고아 작업 정리 완료`);
    },
    onError: () => toast.error('정리에 실패했습니다'),
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

  // 구독 소스명 → 분석 트리거 소스명 매핑 (collector: 'naver-news' → analysis: 'naver')
  const mapSubSources = (srcs: string[]): SourceId[] =>
    srcs.map((s) => (s === 'naver-news' ? 'naver' : s) as SourceId);

  const handleSubscriptionSelect = (sub: SubscriptionSummary) => {
    setSubscriptionMode({ isActive: true, subscription: sub });
    setKeyword(sub.keyword);
    setSources(mapSubSources(sub.sources));
    setForceRefetch(false);
    setEnableItemAnalysis(sub.options.includeComments !== false);
    setCollectTranscript(!!sub.options.collectTranscript);
    if (sub.limits.maxPerRun) {
      setMaxNaverArticles(Math.min(sub.limits.maxPerRun, 5000));
      setMaxYoutubeVideos(Math.min(Math.round(sub.limits.maxPerRun / 10), 500));
      setMaxCommunityPosts(Math.min(Math.round(sub.limits.maxPerRun / 10), 500));
    }
    if (sub.limits.commentsPerItem) {
      setMaxCommentsPerItem(Math.min(sub.limits.commentsPerItem, 2000));
    }
  };

  const handleSubscriptionClear = () => {
    setSubscriptionMode({ isActive: false, subscription: null });
    setKeyword('');
    setSources([...ALL_SOURCES]);
    setForceRefetch(false);
    setEnableItemAnalysis(true);
    setCollectTranscript(false);
    setOptimizationPreset('rag-standard');
    if (defaultLimits) {
      setMaxNaverArticles(defaultLimits.naverArticles);
      setMaxYoutubeVideos(defaultLimits.youtubeVideos);
      setMaxCommunityPosts(defaultLimits.communityPosts);
      setMaxCommentsPerItem(defaultLimits.commentsPerItem);
    }
  };

  const isSubMode = subscriptionMode.isActive;

  const doTrigger = () => {
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
        enableItemAnalysis || optimizationPreset !== 'none' || collectTranscript
          ? {
              ...(enableItemAnalysis && { enableItemAnalysis: true }),
              ...(optimizationPreset !== 'none' && { tokenOptimization: optimizationPreset }),
              ...(collectTranscript && { collectTranscript: true }),
            }
          : undefined,
      limits: {
        naverArticles: maxNaverArticles,
        youtubeVideos: maxYoutubeVideos,
        communityPosts: maxCommunityPosts,
        commentsPerItem: maxCommentsPerItem,
      },
      // 기간 모드: 입력값은 날짜별 한도. 이벤트 중심: 총량.
      limitMode: dateMode === 'period' ? 'perDay' : 'total',
      breakpoints: breakpoints.length > 0 ? breakpoints : undefined,
      ...(selectedSeriesId && { seriesId: selectedSeriesId }),
      ...(createNewSeries && { createNewSeries: true }),
      ...(!isSubMode && forceRefetch && { forceRefetch: true }),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || (sources.length === 0 && customSourceIds.length === 0)) return;

    try {
      const orphans = await trpcClient.admin.workerMgmt.checkOrphanedJobs.query();
      if (orphans.count > 0) {
        setOrphanDialog({ open: true, count: orphans.count, pendingSubmit: doTrigger });
        return;
      }
    } catch {
      // 권한 없거나 API 실패 시 무시하고 진행
    }

    doTrigger();
  };

  // 기간 모드에서는 수집 한도를 '날짜별'로 해석하므로 도움말 문구를 모드별로 전환한다.
  const isPerDay = dateMode === 'period';
  const perDaySuffix = isPerDay
    ? ' 기간 모드에서는 이 값이 날짜별 한도이며, 실제 수집 총량 = 값 × 일수입니다.'
    : '';
  const sectionHeaderTooltip = isPerDay
    ? '수집할 데이터의 날짜별 수량과 AI 처리 전략을 설정합니다. 값을 줄이면 분석 비용과 시간이 절감됩니다.'
    : '수집할 데이터 양과 AI 처리 전략을 설정합니다. 값을 줄이면 분석 비용과 시간이 절감됩니다.';
  const limitsDescription = isPerDay
    ? '소스별 날짜당 수집 건수를 조절합니다. 줄이면 비용과 시간이 절약됩니다.'
    : '소스별 최대 수집 건수를 조절합니다. 줄이면 비용과 시간이 절약됩니다.';

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">분석 실행</CardTitle>
      </CardHeader>
      <CardContent>
        {/* 데모 사용자 쿼터 정보 */}
        {isDemo && demoQuota && <DemoQuotaBadge quota={demoQuota} />}

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
            <div className="flex gap-2">
              <div className="flex flex-1 gap-2">
                <Input
                  id="keyword"
                  placeholder="인물 또는 키워드 입력"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  required
                  maxLength={50}
                  disabled={triggerMutation.isPending || isSubMode}
                  className="flex-1"
                />
                {isSubMode && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-xs gap-1"
                    onClick={handleSubscriptionClear}
                    title="구독 모드 해제"
                  >
                    <span className="max-w-[120px] truncate">
                      {subscriptionMode.subscription?.keyword}
                    </span>
                    ✕
                  </Button>
                )}
              </div>
              {!isSubMode && (
                <SubscriptionPicker
                  onSelect={handleSubscriptionSelect}
                  disabled={triggerMutation.isPending}
                />
              )}
            </div>
          </div>

          {/* 시리즈 연결 */}
          <SeriesSelector
            keyword={keyword}
            onSeriesSelect={handleSeriesSelect}
            selectedSeriesId={selectedSeriesId}
            createNewSeries={createNewSeries}
          />

          {/* 소스 선택 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>소스</Label>
              {isSubMode && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  구독 설정
                </span>
              )}
            </div>
            <div className="space-y-3">
              {/* 전체 선택 */}
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={(checked) => handleAllToggle(!!checked)}
                  disabled={triggerMutation.isPending || isSubMode}
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
                          disabled={triggerMutation.isPending || isSubMode}
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
                          disabled={triggerMutation.isPending || isSubMode}
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
            <div className="flex items-center gap-2">
              <Label>분석 옵션</Label>
              {isSubMode && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  구독 설정
                </span>
              )}
            </div>
            <label
              suppressHydrationWarning
              className={`flex items-start gap-2 rounded-lg border p-3 transition-colors ${isDemo ? 'opacity-70' : 'cursor-pointer hover:bg-accent/50'}`}
            >
              <Checkbox
                checked={enableItemAnalysis}
                onCheckedChange={(checked) => setEnableItemAnalysis(!!checked)}
                disabled={isDemo || triggerMutation.isPending || isSubMode}
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
            {sources.includes('youtube') && (
              <label
                className={`flex items-start gap-2 rounded-lg border p-3 transition-colors ${isDemo ? 'opacity-70' : 'cursor-pointer hover:bg-accent/50'}`}
              >
                <Checkbox
                  checked={collectTranscript}
                  onCheckedChange={(checked) => setCollectTranscript(!!checked)}
                  disabled={isDemo || triggerMutation.isPending || isSubMode}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <span className="text-sm font-medium">유튜브 자막 수집</span>
                  <p className="text-xs text-muted-foreground">
                    영상 자막을 수집합니다. YouTube 자막이 없는 영상은 조회수 상위 20건에 한해
                    오디오를 자동 전사(Whisper)해 채웁니다. 다음 분석 실행부터 반영됩니다.
                  </p>
                </div>
              </label>
            )}
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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger onClick={(e) => e.stopPropagation()} className="cursor-help">
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[220px] text-center">
                      {sectionHeaderTooltip}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
              <TooltipProvider>
                <div className="mt-2 space-y-3 rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{limitsDescription}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="maxNaver" className="text-xs flex items-center gap-1">
                        네이버 뉴스
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">
                            <HelpCircle className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px]">
                            수집할 네이버 뉴스 기사의 최대 건수입니다. 키워드와 기간에 따라 실제
                            수집량은 이보다 적을 수 있습니다.{perDaySuffix} (범위: 10 ~ 5,000건)
                          </TooltipContent>
                        </Tooltip>
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
                      <Label htmlFor="maxYoutube" className="text-xs flex items-center gap-1">
                        유튜브 영상
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">
                            <HelpCircle className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px]">
                            수집할 유튜브 영상의 최대 건수입니다. 영상 제목·설명·댓글을 분석합니다.
                            {perDaySuffix} (범위: 5 ~ 500건)
                          </TooltipContent>
                        </Tooltip>
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
                      <Label htmlFor="maxCommunity" className="text-xs flex items-center gap-1">
                        커뮤니티 게시글
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">
                            <HelpCircle className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px]">
                            DC갤러리·에펨코리아·클리앙 등 선택한 커뮤니티에서 수집할 게시글
                            수입니다.{perDaySuffix} (범위: 5 ~ 500건)
                          </TooltipContent>
                        </Tooltip>
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
                      <Label htmlFor="maxComments" className="text-xs flex items-center gap-1">
                        항목당 댓글
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">
                            <HelpCircle className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px]">
                            각 기사/게시글/영상에서 수집할 댓글의 최대 건수입니다. 댓글은 AI 분석의
                            주요 여론 신호입니다. (범위: 10 ~ 2,000건)
                          </TooltipContent>
                        </Tooltip>
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
                    <Label className="text-xs flex items-center gap-1">
                      토큰 최적화
                      <Tooltip>
                        <TooltipTrigger className="cursor-help">
                          <HelpCircle className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[220px]">
                          수집된 데이터를 AI에 전달하기 전에 전처리하여 토큰(비용·속도)을 줄이는
                          설정입니다. 높을수록 비용이 절감되지만 일부 데이터가 제외됩니다.
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    {/* 기존 모드 */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {(
                        Object.entries(OPTIMIZATION_PRESETS).filter(
                          ([, p]) => p.group === 'classic',
                        ) as [
                          OptimizationPreset,
                          (typeof OPTIMIZATION_PRESETS)[OptimizationPreset],
                        ][]
                      ).map(([key, preset]) => {
                        const style = PRESET_STYLES[key];
                        return (
                          <Tooltip key={key}>
                            <TooltipTrigger
                              render={
                                <button
                                  type="button"
                                  onClick={() => setOptimizationPreset(key)}
                                  disabled={triggerMutation.isPending}
                                  className={`rounded-md border p-2 text-center transition-colors w-full ${
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
                              }
                            />
                            <TooltipContent side="bottom" className="max-w-[180px]">
                              {preset.description}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                    {/* RAG 모드 */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        Object.entries(OPTIMIZATION_PRESETS).filter(
                          ([, p]) => p.group === 'rag',
                        ) as [
                          OptimizationPreset,
                          (typeof OPTIMIZATION_PRESETS)[OptimizationPreset],
                        ][]
                      ).map(([key, preset]) => {
                        const style = PRESET_STYLES[key];
                        return (
                          <Tooltip key={key}>
                            <TooltipTrigger
                              render={
                                <button
                                  type="button"
                                  onClick={() => setOptimizationPreset(key)}
                                  disabled={triggerMutation.isPending}
                                  className={`rounded-md border p-2 text-center transition-colors w-full ${
                                    optimizationPreset === key
                                      ? `${style?.border} ${style?.bg}`
                                      : 'border-border hover:bg-accent'
                                  }`}
                                >
                                  <div
                                    className={`text-xs font-medium ${
                                      optimizationPreset === key
                                        ? style?.text
                                        : 'text-muted-foreground'
                                    }`}
                                  >
                                    {preset.label}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground mt-0.5">
                                    {preset.estimatedReduction}↓
                                  </div>
                                </button>
                              }
                            />
                            <TooltipContent side="bottom" className="max-w-[180px]">
                              {preset.description}
                            </TooltipContent>
                          </Tooltip>
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
              </TooltipProvider>
            </CollapsibleContent>
          </Collapsible>

          {/* 전량 재수집 옵션 — 데모 사용자에게는 표시하지 않음 */}
          {!isDemo && !isSubMode && (
            <label className="flex items-start gap-2 rounded-lg border p-3 transition-colors cursor-pointer hover:bg-accent/50">
              <Checkbox
                checked={forceRefetch}
                onCheckedChange={(checked) => setForceRefetch(!!checked)}
                disabled={triggerMutation.isPending}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <span className="text-sm font-medium flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  전량 재수집
                </span>
                <p className="text-xs text-muted-foreground">
                  이전에 수집한 동일 기사/댓글을 무시하고 전부 새로 수집합니다. 일반적으로
                  불필요하며, 최신 데이터가 반드시 필요한 경우에만 사용하세요.
                </p>
              </div>
            </label>
          )}

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

        {/* 고아 작업 확인 다이얼로그 */}
        <OrphanJobsDialog
          open={orphanDialog.open}
          count={orphanDialog.count}
          onOpenChange={(open) => {
            if (!open) setOrphanDialog({ open: false, count: 0, pendingSubmit: null });
          }}
          onJustRun={() => {
            orphanDialog.pendingSubmit?.();
            setOrphanDialog({ open: false, count: 0, pendingSubmit: null });
          }}
          onCleanupAndRun={async () => {
            await cleanupMutation.mutateAsync();
            orphanDialog.pendingSubmit?.();
            setOrphanDialog({ open: false, count: 0, pendingSubmit: null });
          }}
        />
      </CardContent>
    </Card>
  );
}
