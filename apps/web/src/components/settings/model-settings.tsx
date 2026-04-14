'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  HelpCircle,
  Loader2,
  RotateCcw,
  AlertTriangle,
  ChevronsUpDown,
  Sparkles,
  Zap,
  ArrowRight,
  Shield,
  Heart,
} from 'lucide-react';
import { PROVIDER_REGISTRY, type AIProvider } from '@ai-signalcraft/core/ai-meta';
import {
  MODULE_META,
  COMMON_MODULES,
  DOMAIN_MODULES,
  PRESET_DOMAIN_MAP,
  CATEGORY_ORDER,
} from './module-meta';
import { trpcClient } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

function getModulesForPreset(presetSlug?: string): string[] {
  if (!presetSlug) {
    // 전체 목록: 중복 제거 (crisis-scenario 등이 여러 도메인에 존재)
    const allDomainModules = [
      ...DOMAIN_MODULES.political,
      ...DOMAIN_MODULES.policy,
      ...DOMAIN_MODULES.fandom,
      ...DOMAIN_MODULES.corporate,
      ...DOMAIN_MODULES.pr,
      ...DOMAIN_MODULES.finance,
      ...DOMAIN_MODULES.healthcare,
      ...DOMAIN_MODULES.legal,
      ...DOMAIN_MODULES.education,
      ...DOMAIN_MODULES['public-sector'],
      ...DOMAIN_MODULES.sports,
      ...DOMAIN_MODULES.retail,
    ];
    return [...COMMON_MODULES, ...Array.from(new Set(allDomainModules))];
  }
  const domain = PRESET_DOMAIN_MAP[presetSlug]?.domain ?? 'political';
  return [...COMMON_MODULES, ...(DOMAIN_MODULES[domain] ?? DOMAIN_MODULES.political)];
}

// ── 프로바이더 표시명 ──

function getProviderLabel(provider: string): string {
  return PROVIDER_REGISTRY[provider as AIProvider]?.displayName ?? provider;
}

// ── 타입 ──

type ModelSettingItem = {
  moduleName: string;
  provider: string;
  model: string;
  isCustom: boolean;
  source?: 'preset' | 'global' | 'default';
};

type PresetInfo = {
  id: string;
  slug: string;
  category: string;
  domain: string;
  title: string;
  icon: string;
  highlight: string | null;
};

// ── 메인 컴포넌트 ──

export function ModelSettings() {
  const queryClient = useQueryClient();
  const [selectedPresetSlug, setSelectedPresetSlug] = useState<string | null>(null);

  // 설정 목록 (프리셋 필터)
  const { data: settings, isLoading } = useQuery({
    queryKey: [['settings', 'list', selectedPresetSlug]],
    queryFn: () =>
      trpcClient.settings.list.query(
        selectedPresetSlug ? { presetSlug: selectedPresetSlug } : undefined,
      ),
  });

  // 프리셋 목록
  const { data: presets } = useQuery({
    queryKey: ['presets', 'enabled'],
    queryFn: () => trpcClient.presets.listEnabled.query(),
    staleTime: 5 * 60 * 1000,
  });

  // 시나리오 프리셋 목록
  const { data: scenarioPresets } = useQuery({
    queryKey: [['settings', 'modelScenarios', 'list']],
    queryFn: () => trpcClient.settings.modelScenarios.list.query(),
  });

  // API 키
  const { data: providerKeysList } = useQuery({
    queryKey: [['settings', 'providerKeys', 'list']],
    queryFn: () => trpcClient.settings.providerKeys.list.query(),
  });

  // 등록된 프로바이더/모델 목록
  const { availableProviders, providerModels } = useMemo(() => {
    if (!providerKeysList || providerKeysList.length === 0) {
      return { availableProviders: [] as string[], providerModels: {} as Record<string, string[]> };
    }
    const MAIN_MODEL_PATTERNS = [
      /^gpt-4/,
      /^gpt-5/,
      /^gpt-3\.5/,
      /^o[1-9]/,
      /^claude/,
      /^gemini/,
      /^qwen/,
      /^llama/,
      /^mistral/,
      /^deepseek/,
      /^codestral/,
      /^command/,
    ];
    function isMainModel(model: string): boolean {
      return MAIN_MODEL_PATTERNS.some((p) => p.test(model));
    }
    const modelsMap: Record<string, Set<string>> = {};
    for (const key of providerKeysList) {
      if (!key.isActive) continue;
      if (!modelsMap[key.providerType]) modelsMap[key.providerType] = new Set();
      const models = (key as any).availableModels as string[] | null;
      if (models?.length) {
        for (const m of models) {
          if (isMainModel(m)) modelsMap[key.providerType].add(m);
        }
      }
      if (key.selectedModel) modelsMap[key.providerType].add(key.selectedModel);
    }
    const providers = Object.keys(modelsMap).sort();
    const models: Record<string, string[]> = {};
    for (const [p, s] of Object.entries(modelsMap)) models[p] = [...s].sort();
    return { availableProviders: providers, providerModels: models };
  }, [providerKeysList]);

  // 뮤테이션들
  const updateMutation = useMutation({
    mutationFn: (input: { moduleName: string; provider: string; model: string }) =>
      trpcClient.settings.update.mutate(input as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['settings', 'list']] });
      toast.success('모델 설정이 변경되었습니다');
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? '설정 변경에 실패했습니다');
    },
  });

  const updatePresetMutation = useMutation({
    mutationFn: (input: {
      presetSlug: string;
      moduleName: string;
      provider: string;
      model: string;
    }) => trpcClient.settings.updatePreset.mutate(input as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['settings', 'list']] });
      toast.success('프리셋 모델 설정이 변경되었습니다');
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? '설정 변경에 실패했습니다');
    },
  });

  const resetPresetMutation = useMutation({
    mutationFn: (input: { presetSlug: string; moduleName: string }) =>
      trpcClient.settings.resetPresetModel.mutate(input as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['settings', 'list']] });
      toast.success('기본 설정으로 복원되었습니다');
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? '복원에 실패했습니다');
    },
  });

  const resetMutation = useMutation({
    mutationFn: (moduleName: string) => trpcClient.settings.resetToDefault.mutate({ moduleName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['settings', 'list']] });
      toast.success('기본값으로 복원되었습니다');
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? '복원에 실패했습니다');
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: (input: { provider: string; model: string; presetSlug?: string }) =>
      trpcClient.settings.bulkUpdate.mutate(input as any),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [['settings', 'list']] });
      toast.success(`전체 ${data.updated}개 모듈의 모델이 변경되었습니다`);
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? '일괄 변경에 실패했습니다');
    },
  });

  const scenarioMutation = useMutation({
    mutationFn: (input: { presetId: string; targetPresetSlug?: string }) =>
      trpcClient.settings.modelScenarios.applyPreset.mutate(input as any),
    onSuccess: (data) => {
      setScenarioDialogOpen(null);
      queryClient.invalidateQueries({ queryKey: [['settings', 'list']] });
      toast.success(`"${data.presetName}" 시나리오가 적용되었습니다 (${data.updated}개 모듈)`);
    },
    onError: (error: { message?: string }) => {
      setScenarioDialogOpen(null);
      toast.error(error.message ?? '시나리오 적용에 실패했습니다');
    },
  });

  const [bulkProvider, setBulkProvider] = useState<string>('');
  const [bulkModel, setBulkModel] = useState<string>('');
  const [scenarioDialogOpen, setScenarioDialogOpen] = useState<string | null>(null);

  // 표시할 모듈 필터링
  const visibleModules = useMemo(
    () => getModulesForPreset(selectedPresetSlug ?? undefined),
    [selectedPresetSlug],
  );
  const currentDomain = selectedPresetSlug ? PRESET_DOMAIN_MAP[selectedPresetSlug]?.domain : null;

  // 프리셋을 카테고리별로 그룹화
  const presetGroups = useMemo(() => {
    if (!presets) return {};
    const map: Record<string, PresetInfo[]> = {};
    for (const p of presets) {
      const info = PRESET_DOMAIN_MAP[p.slug];
      if (!info) continue;
      const cat = info.category;
      if (!map[cat]) map[cat] = [];
      map[cat].push({
        id: p.id,
        slug: p.slug,
        category: cat,
        domain: info.domain,
        title: info.title,
        icon: p.icon,
        highlight: p.highlight,
      });
    }
    return map;
  }, [presets]);

  const handleProviderChange = (item: ModelSettingItem, newProvider: string | null) => {
    if (!newProvider) return;
    const firstModel = providerModels[newProvider]?.[0] ?? '';
    if (selectedPresetSlug) {
      updatePresetMutation.mutate({
        presetSlug: selectedPresetSlug,
        moduleName: item.moduleName,
        provider: newProvider,
        model: firstModel,
      });
    } else {
      updateMutation.mutate({
        moduleName: item.moduleName,
        provider: newProvider,
        model: firstModel,
      });
    }
  };

  const handleModelChange = (item: ModelSettingItem, newModel: string | null) => {
    if (!newModel) return;
    if (selectedPresetSlug) {
      updatePresetMutation.mutate({
        presetSlug: selectedPresetSlug,
        moduleName: item.moduleName,
        provider: item.provider,
        model: newModel,
      });
    } else {
      updateMutation.mutate({
        moduleName: item.moduleName,
        provider: item.provider,
        model: newModel,
      });
    }
  };

  const handleReset = (item: ModelSettingItem) => {
    if (selectedPresetSlug) {
      resetPresetMutation.mutate({ presetSlug: selectedPresetSlug, moduleName: item.moduleName });
    } else {
      resetMutation.mutate(item.moduleName);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        설정 불러오는 중...
      </div>
    );
  }

  if (!settings || settings.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">설정을 불러올 수 없습니다.</div>;
  }

  const isPending =
    updateMutation.isPending ||
    updatePresetMutation.isPending ||
    resetMutation.isPending ||
    resetPresetMutation.isPending ||
    bulkUpdateMutation.isPending ||
    scenarioMutation.isPending;
  const hasProviders = availableProviders.length > 0;
  const bulkModels = bulkProvider ? (providerModels[bulkProvider] ?? []) : [];

  return (
    <div className="space-y-3">
      {/* API 키 없음 안내 */}
      {!hasProviders && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">등록된 API 키가 없습니다</p>
            <p className="mt-1">
              위의 <strong>API 키 관리</strong> 탭에서 프로바이더를 등록하고 모델을 선택해주세요.
            </p>
          </div>
        </div>
      )}

      {/* 프리셋 선택 탭바 */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">분석 유형</span>
          <span className="text-xs text-muted-foreground">— 유형별로 다른 AI 모델 설정</span>
        </div>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-1 pb-1">
            {/* 기본(전체) 버튼 */}
            <button
              onClick={() => setSelectedPresetSlug(null)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors shrink-0 ${
                selectedPresetSlug === null
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-accent'
              }`}
            >
              전체 모듈
            </button>
            {/* 카테고리별 프리셋 */}
            {CATEGORY_ORDER.map((cat) => {
              const group = presetGroups[cat];
              if (!group?.length) return null;
              return (
                <div key={cat} className="flex items-center gap-1 shrink-0">
                  <span className="text-muted-foreground/50 text-xs select-none">|</span>
                  {group.map((p) => {
                    const isActive = selectedPresetSlug === p.slug;
                    const isFandom = p.domain === 'fandom';
                    return (
                      <button
                        key={p.slug}
                        onClick={() => setSelectedPresetSlug(isActive ? null : p.slug)}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors shrink-0 ${
                          isActive
                            ? isFandom
                              ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400'
                              : 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:bg-accent'
                        }`}
                      >
                        <span>{p.title}</span>
                        {isFandom ? (
                          <Heart className="h-3 w-3 text-violet-500" />
                        ) : (
                          <Shield className="h-3 w-3 text-blue-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        {selectedPresetSlug && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>
              선택:{' '}
              <strong className="text-foreground">
                {PRESET_DOMAIN_MAP[selectedPresetSlug]?.title}
              </strong>
            </span>
            <span>
              (
              {(
                {
                  fandom: '팬덤',
                  policy: '정책',
                  corporate: '기업',
                  pr: 'PR',
                  finance: '금융',
                  healthcare: '헬스케어',
                } as Record<string, string>
              )[PRESET_DOMAIN_MAP[selectedPresetSlug]?.domain] ?? '정치'}{' '}
              도메인 — {getModulesForPreset(selectedPresetSlug).length}개 모듈)
            </span>
            <button
              onClick={() => setSelectedPresetSlug(null)}
              className="ml-1 text-primary hover:underline"
            >
              전체 보기
            </button>
          </div>
        )}
      </div>

      {/* 시나리오 프리셋 */}
      {scenarioPresets && scenarioPresets.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">시나리오 프리셋</span>
            <span className="text-xs text-muted-foreground">— 모듈별 최적 모델을 한 번에 적용</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {scenarioPresets.map((preset) => {
              const isRecommended = preset.id === 'scenario-b';
              const requiredProviders = new Set(
                Object.values(preset.modules).map((m: any) => m.provider),
              );
              const registeredProviders = new Set(
                providerKeysList?.filter((k) => k.isActive).map((k) => k.providerType) ?? [],
              );
              const missingProviders = [...requiredProviders].filter(
                (p) => !registeredProviders.has(p),
              );
              return (
                <div
                  key={preset.id}
                  className={`relative rounded-lg border p-3 ${isRecommended ? 'border-primary/40 bg-primary/5' : 'border-border'}`}
                >
                  {isRecommended && (
                    <Badge className="absolute -top-2 right-2 text-[10px]">추천</Badge>
                  )}
                  <div className="flex items-center gap-1.5 mb-1">
                    {isRecommended ? (
                      <Zap className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">{preset.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                    {preset.description}
                  </p>
                  {missingProviders.length > 0 && (
                    <div className="flex items-start gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/5 p-2 mb-2">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        미등록: {missingProviders.map((p) => getProviderLabel(p)).join(', ')}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-muted-foreground">
                      {preset.estimatedCost}
                    </span>
                    <AlertDialog
                      open={scenarioDialogOpen === preset.id}
                      onOpenChange={(open) => setScenarioDialogOpen(open ? preset.id : null)}
                    >
                      <AlertDialogTrigger
                        className={`inline-flex items-center justify-center rounded-md text-xs h-7 px-3 ${
                          isRecommended
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                            : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
                        } ${isPending ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
                      >
                        적용
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>시나리오 적용</AlertDialogTitle>
                          <AlertDialogDescription>
                            &quot;{preset.name}&quot; 시나리오를{' '}
                            {selectedPresetSlug
                              ? `"${PRESET_DOMAIN_MAP[selectedPresetSlug]?.title}" 프리셋에`
                              : '전체 모듈에'}{' '}
                            적용하시겠습니까?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>취소</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(e) => {
                              e.preventDefault();
                              scenarioMutation.mutate({
                                presetId: preset.id,
                                targetPresetSlug: selectedPresetSlug ?? undefined,
                              });
                            }}
                          >
                            {scenarioMutation.isPending ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : null}
                            적용
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 전체 일괄 변경 */}
      {hasProviders && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <ChevronsUpDown className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">전체 일괄 변경</span>
            <span className="text-xs text-muted-foreground">
              —{' '}
              {selectedPresetSlug
                ? `"${PRESET_DOMAIN_MAP[selectedPresetSlug]?.title}" 프리셋에만`
                : '모든 모듈에'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={bulkProvider}
              onValueChange={(val) => {
                setBulkProvider(val ?? '');
                setBulkModel('');
              }}
              disabled={isPending}
            >
              <SelectTrigger className="w-[130px]" size="sm">
                <SelectValue placeholder="프로바이더" />
              </SelectTrigger>
              <SelectContent>
                {availableProviders.map((provider) => (
                  <SelectItem key={provider} value={provider}>
                    {getProviderLabel(provider)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={bulkModel}
              onValueChange={(val) => setBulkModel(val ?? '')}
              disabled={isPending || bulkModels.length === 0}
            >
              <SelectTrigger className="flex-1" size="sm">
                <SelectValue
                  placeholder={bulkModels.length > 0 ? '모델 선택' : '프로바이더를 먼저 선택'}
                />
              </SelectTrigger>
              <SelectContent>
                {bulkModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={isPending || !bulkProvider || !bulkModel}
              onClick={() => {
                bulkUpdateMutation.mutate(
                  {
                    provider: bulkProvider,
                    model: bulkModel,
                    presetSlug: selectedPresetSlug ?? undefined,
                  },
                  {
                    onSuccess: () => {
                      setBulkProvider('');
                      setBulkModel('');
                    },
                  },
                );
              }}
            >
              {bulkUpdateMutation.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : null}
              전체 적용
            </Button>
          </div>
        </div>
      )}

      {/* 모듈 목록 */}
      {(() => {
        const settingsMap = new Map(settings.map((s: ModelSettingItem) => [s.moduleName, s]));
        const commonVisible = visibleModules.filter((m) => COMMON_MODULES.includes(m));
        const domainVisible = visibleModules.filter((m) => !COMMON_MODULES.includes(m));

        return (
          <div className="space-y-4">
            {/* 공통 모듈 */}
            {commonVisible.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  공통 모듈
                </p>
                {commonVisible.map((moduleName) => {
                  const item = settingsMap.get(moduleName);
                  if (!item) return null;
                  return (
                    <ModuleCard
                      key={moduleName}
                      item={item}
                      hasProviders={hasProviders}
                      availableProviders={availableProviders}
                      currentModels={providerModels[item.provider] ?? []}
                      isPending={isPending}
                      onProviderChange={handleProviderChange}
                      onModelChange={handleModelChange}
                      onReset={handleReset}
                    />
                  );
                })}
              </div>
            )}
            {/* 도메인 전용 모듈 */}
            {domainVisible.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{
                      color: currentDomain === 'fandom' ? 'rgb(139,92,246)' : 'hsl(var(--primary))',
                    }}
                  >
                    {(
                      {
                        fandom: '팬덤 전용',
                        policy: '정책 전용',
                        corporate: '기업 전용',
                        pr: 'PR 전용',
                        finance: '금융 전용',
                        healthcare: '헬스케어 전용',
                      } as Record<string, string>
                    )[currentDomain ?? ''] ?? '정치 전용'}{' '}
                    모듈
                  </p>
                  <div className="flex-1 border-t" />
                </div>
                {domainVisible.map((moduleName) => {
                  const item = settingsMap.get(moduleName);
                  if (!item) return null;
                  return (
                    <ModuleCard
                      key={moduleName}
                      item={item}
                      hasProviders={hasProviders}
                      availableProviders={availableProviders}
                      currentModels={providerModels[item.provider] ?? []}
                      isPending={isPending}
                      onProviderChange={handleProviderChange}
                      onModelChange={handleModelChange}
                      onReset={handleReset}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ── 모듈 카드 ──

function ModuleCard({
  item,
  hasProviders,
  availableProviders,
  currentModels,
  isPending,
  onProviderChange,
  onModelChange,
  onReset,
}: {
  item: ModelSettingItem;
  hasProviders: boolean;
  availableProviders: string[];
  currentModels: string[];
  isPending: boolean;
  onProviderChange: (item: ModelSettingItem, provider: string | null) => void;
  onModelChange: (item: ModelSettingItem, model: string | null) => void;
  onReset: (item: ModelSettingItem) => void;
}) {
  const isModelAvailable = currentModels.includes(item.model);
  const meta = MODULE_META[item.moduleName];
  const domain = meta?.domain;

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">{meta?.name ?? item.moduleName}</span>
          {domain && (
            <Badge
              className={`text-[9px] ${domain === 'fandom' ? 'bg-violet-500/15 text-violet-500 border-violet-500/20' : domain === 'corporate' ? 'bg-sky-500/15 text-sky-600 border-sky-500/20' : domain === 'pr' ? 'bg-orange-500/15 text-orange-600 border-orange-500/20' : domain === 'policy' ? 'bg-indigo-500/15 text-indigo-600 border-indigo-500/20' : 'bg-blue-500/15 text-blue-500 border-blue-500/20'}`}
            >
              {(
                {
                  fandom: '팬덤',
                  policy: '정책',
                  corporate: '기업',
                  pr: 'PR',
                  finance: '금융',
                  healthcare: '헬스케어',
                } as Record<string, string>
              )[domain] ?? '정치'}
            </Badge>
          )}
          <span className="text-xs font-mono text-muted-foreground">{item.moduleName}</span>
          <ModuleHelpPopover moduleName={item.moduleName} />
          {item.source ? (
            sourceBadge(item.source)
          ) : item.isCustom ? (
            <Badge variant="secondary" className="text-[10px]">
              사용자 설정
            </Badge>
          ) : null}
        </div>
        {(item.isCustom || item.source === 'preset') && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            disabled={isPending}
            onClick={() => onReset(item)}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            {item.source === 'preset' ? '글로벌로' : '기본값'}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={hasProviders && availableProviders.includes(item.provider) ? item.provider : ''}
          onValueChange={(val) => onProviderChange(item, val)}
          disabled={isPending || !hasProviders}
        >
          <SelectTrigger className="w-[130px]" size="sm">
            <SelectValue placeholder={hasProviders ? '프로바이더' : '키 없음'} />
          </SelectTrigger>
          <SelectContent>
            {availableProviders.map((provider) => (
              <SelectItem key={provider} value={provider}>
                {getProviderLabel(provider)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={isModelAvailable ? item.model : ''}
          onValueChange={(val) => onModelChange(item, val)}
          disabled={isPending || !hasProviders || currentModels.length === 0}
        >
          <SelectTrigger className="flex-1" size="sm">
            <SelectValue placeholder={currentModels.length > 0 ? '모델 선택' : '모델 없음'} />
          </SelectTrigger>
          <SelectContent>
            {currentModels.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {item.isCustom &&
        hasProviders &&
        (!availableProviders.includes(item.provider) || !isModelAvailable) && (
          <p className="text-xs text-amber-500">
            현재 설정된{' '}
            {!availableProviders.includes(item.provider)
              ? `프로바이더(${item.provider})`
              : `모델(${item.model})`}
            이(가) API 키 관리에 등록되지 않았습니다.
          </p>
        )}
    </div>
  );
}

function sourceBadge(source: string) {
  if (source === 'preset')
    return (
      <Badge className="text-[10px] bg-violet-500/15 text-violet-500 border-violet-500/20">
        프리셋
      </Badge>
    );
  if (source === 'global')
    return (
      <Badge variant="secondary" className="text-[10px]">
        글로벌
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-[10px] text-muted-foreground">
      기본
    </Badge>
  );
}

// ── 도움말 팝오버 ──

function ModuleHelpPopover({ moduleName }: { moduleName: string }) {
  const meta = MODULE_META[moduleName];
  if (!meta) return null;

  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary">
        <HelpCircle className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-80 p-0">
        <div className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{meta.description}</p>
          <div>
            <p className="text-xs font-semibold text-foreground mb-1.5">분석 항목</p>
            <ul className="space-y-1">
              {meta.analyzes.map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-md bg-muted/50 p-2.5">
            <p className="text-xs font-semibold text-foreground mb-1">추천 모델</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{meta.recommended.provider}</span>
              {' / '}
              <span className="font-mono text-[11px]">{meta.recommended.model}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">{meta.recommended.reason}</p>
          </div>
          <div className="flex items-start gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5">
            <span className="text-xs leading-none mt-0.5">💡</span>
            <p className="text-xs text-muted-foreground leading-relaxed">{meta.costTip}</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
