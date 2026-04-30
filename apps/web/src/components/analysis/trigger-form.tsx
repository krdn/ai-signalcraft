'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Loader2, RefreshCw } from 'lucide-react';
import { subDays, addDays } from 'date-fns';
import { TriggerFormHelp } from './trigger-form-help';
import { DomainBadge } from './domain-badge';
import { BreakpointSection, type BreakpointValue } from './trigger-form/breakpoint-section';
import { SeriesSelector } from './trigger-form/series-selector';
import { type OptimizationPreset, type SourceId, ALL_SOURCES } from './trigger-form-data';
import { type SubscriptionSummary } from './subscription-picker';
import { KeywordInput } from './trigger-form/keyword-input';
import { OrphanJobsDialog } from './trigger-form/orphan-jobs-dialog';
import { DemoQuotaBadge } from './trigger-form/demo-quota-badge';
import { SourceSelector } from './trigger-form/source-selector';
import { DateRangeSelector } from './trigger-form/date-range-selector';
import { AnalysisOptions } from './trigger-form/analysis-options';
import { CollectionLimitsPanel } from './trigger-form/collection-limits-panel';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

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
          <KeywordInput
            keyword={keyword}
            onKeywordChange={setKeyword}
            isSubMode={isSubMode}
            subscription={subscriptionMode.subscription}
            onSubscriptionSelect={handleSubscriptionSelect}
            onSubscriptionClear={handleSubscriptionClear}
            disabled={triggerMutation.isPending}
          />

          {/* 시리즈 연결 */}
          <SeriesSelector
            keyword={keyword}
            onSeriesSelect={handleSeriesSelect}
            selectedSeriesId={selectedSeriesId}
            createNewSeries={createNewSeries}
          />

          {/* 소스 선택 */}
          <SourceSelector
            sources={sources}
            customSourceIds={customSourceIds}
            customSources={customSources}
            isSubMode={isSubMode}
            isDemo={isDemo}
            disabled={triggerMutation.isPending}
            onAllToggle={handleAllToggle}
            onSourceToggle={handleSourceToggle}
            onCustomSourceToggle={handleCustomSourceToggle}
          />

          {/* 기간 선택 */}
          <DateRangeSelector
            isDemo={isDemo}
            isMounted={isMounted}
            disabled={triggerMutation.isPending}
            dateMode={dateMode}
            onDateModeChange={setDateMode}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            eventName={eventName}
            onEventNameChange={setEventName}
            eventDate={eventDate}
            onEventDateChange={setEventDate}
            eventRadius={eventRadius}
            onEventRadiusChange={setEventRadius}
          />

          {/* 분석 옵션 */}
          <AnalysisOptions
            isDemo={isDemo}
            isSubMode={isSubMode}
            disabled={triggerMutation.isPending}
            enableItemAnalysis={enableItemAnalysis}
            onEnableItemAnalysisChange={setEnableItemAnalysis}
            collectTranscript={collectTranscript}
            onCollectTranscriptChange={setCollectTranscript}
            sources={sources}
          />

          {/* 수집 한도 & 토큰 최적화 */}
          <CollectionLimitsPanel
            isDemo={isDemo}
            isOpen={isLimitsOpen}
            onOpenChange={setIsLimitsOpen}
            disabled={triggerMutation.isPending}
            isPerDay={dateMode === 'period'}
            maxNaverArticles={maxNaverArticles}
            onMaxNaverArticlesChange={setMaxNaverArticles}
            maxYoutubeVideos={maxYoutubeVideos}
            onMaxYoutubeVideosChange={setMaxYoutubeVideos}
            maxCommunityPosts={maxCommunityPosts}
            onMaxCommunityPostsChange={setMaxCommunityPosts}
            maxCommentsPerItem={maxCommentsPerItem}
            onMaxCommentsPerItemChange={setMaxCommentsPerItem}
            optimizationPreset={optimizationPreset}
            onOptimizationPresetChange={setOptimizationPreset}
          />

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
