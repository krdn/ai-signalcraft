'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { Loader2, Shield, Zap, Rocket, Info } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// 프로바이더 표시명
const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  ollama: 'Ollama',
  deepseek: 'DeepSeek',
  xai: 'xAI',
  openrouter: 'OpenRouter',
  custom: 'Custom',
};

// 프리셋별 아이콘
const PRESET_ICONS: Record<string, typeof Shield> = {
  'free-safe': Shield,
  'paid-basic': Zap,
  'paid-max': Rocket,
};

// 프로바이더별 RPM 참고 정보
const PROVIDER_RPM_INFO: Record<string, string> = {
  openai: 'Tier 1: RPM 500 / Tier 3+: RPM 5,000',
  anthropic: 'Tier 1: RPM 50 / Tier 3: RPM 2,000',
  gemini: '무료: RPM 15 / 유료: RPM 2,000',
  ollama: '로컬 GPU 리소스에 따라 다름',
  deepseek: 'RPM ~300',
  xai: 'RPM ~60',
  openrouter: '모델별 상이',
  custom: '엔드포인트에 따라 다름',
};

export function ConcurrencySettings() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: [['settings', 'concurrency', 'get']],
    queryFn: () => trpcClient.settings.concurrency.get.query(),
  });

  const { data: presets } = useQuery({
    queryKey: [['settings', 'concurrency', 'presets']],
    queryFn: () => trpcClient.settings.concurrency.presets.query(),
  });

  const { data: providerKeysList } = useQuery({
    queryKey: [['settings', 'providerKeys', 'list']],
    queryFn: () => trpcClient.settings.providerKeys.list.query(),
  });

  // 등록된 활성 프로바이더 목록
  const activeProviders = useMemo(() => {
    if (!providerKeysList) return [];
    const providers = new Set<string>();
    for (const key of providerKeysList) {
      if (key.isActive) providers.add(key.providerType);
    }
    return [...providers].sort();
  }, [providerKeysList]);

  const applyPresetMutation = useMutation({
    mutationFn: (presetId: string) =>
      trpcClient.settings.concurrency.applyPreset.mutate({ presetId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['settings', 'concurrency', 'get']] });
      toast.success('프리셋이 적용되었습니다');
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? '프리셋 적용에 실패했습니다');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: {
      providerConcurrency?: Record<string, number>;
      apiConcurrency?: number;
      articleBatchSize?: number;
      commentBatchSize?: number;
    }) => trpcClient.settings.concurrency.update.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['settings', 'concurrency', 'get']] });
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? '설정 변경에 실패했습니다');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        설정 불러오는 중...
      </div>
    );
  }

  if (!config) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        설정을 불러올 수 없습니다.
      </div>
    );
  }

  const isPending = applyPresetMutation.isPending || updateMutation.isPending;

  const handleProviderConcurrencyChange = (provider: string, value: number) => {
    const updated = { ...config.providerConcurrency, [provider]: value };
    updateMutation.mutate({ providerConcurrency: updated });
  };

  return (
    <div className="space-y-5">
      {/* 프리셋 선택 */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium">속도 프리셋</span>
          {config.activePreset ? (
            <Badge variant="secondary" className="text-[10px]">
              {presets?.find(p => p.id === config.activePreset)?.name ?? config.activePreset}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">커스텀</Badge>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {presets?.map((preset) => {
            const Icon = PRESET_ICONS[preset.id] ?? Zap;
            const isActive = config.activePreset === preset.id;
            return (
              <button
                key={preset.id}
                disabled={isPending}
                onClick={() => applyPresetMutation.mutate(preset.id)}
                className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors cursor-pointer
                  ${isActive
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium">{preset.name}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  {preset.id === 'free-safe' && '느리지만 안전'}
                  {preset.id === 'paid-basic' && '균형 잡힌 속도'}
                  {preset.id === 'paid-max' && '최대 속도'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 프로바이더별 동시성 */}
      {activeProviders.length > 0 && (
        <div>
          <span className="text-sm font-medium">프로바이더별 동시 호출 수</span>
          <p className="text-xs text-muted-foreground mb-3">같은 프로바이더의 모듈이 동시에 실행되는 최대 수</p>
          <div className="space-y-3">
            {activeProviders.map((provider) => {
              const value = config.providerConcurrency[provider] ?? 2;
              const rpmInfo = PROVIDER_RPM_INFO[provider];
              return (
                <div key={provider} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{PROVIDER_LABELS[provider] ?? provider}</span>
                    <span className="text-xs tabular-nums text-muted-foreground w-6 text-right">{value}</span>
                  </div>
                  <Slider
                    value={[value]}
                    min={1}
                    max={10}
                    step={1}
                    disabled={isPending}
                    onValueCommit={([v]) => handleProviderConcurrencyChange(provider, v)}
                  />
                  {rpmInfo && (
                    <p className="text-[10px] text-muted-foreground">{rpmInfo}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 개별 항목 분석 배치 설정 */}
      <div>
        <span className="text-sm font-medium">개별 항목 분석 배치 설정</span>
        <p className="text-xs text-muted-foreground mb-3">기사/댓글 감정 분석 시 배치 처리 설정</p>
        <div className="space-y-3">
          <SliderRow
            label="API 동시 호출"
            value={config.apiConcurrency}
            min={1}
            max={20}
            disabled={isPending}
            onCommit={(v) => updateMutation.mutate({ apiConcurrency: v })}
          />
          <SliderRow
            label="기사 배치 크기"
            value={config.articleBatchSize}
            min={1}
            max={50}
            disabled={isPending}
            onCommit={(v) => updateMutation.mutate({ articleBatchSize: v })}
          />
          <SliderRow
            label="댓글 배치 크기"
            value={config.commentBatchSize}
            min={5}
            max={200}
            step={5}
            disabled={isPending}
            onCommit={(v) => updateMutation.mutate({ commentBatchSize: v })}
          />
        </div>
      </div>

      {/* RPM 참고 정보 */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          <Info className="h-3 w-3" />
          프로바이더별 RPM 참고 정보
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
            {Object.entries(PROVIDER_RPM_INFO).map(([provider, info]) => (
              <div key={provider} className="flex items-start gap-2 text-[11px]">
                <span className="font-medium w-20 shrink-0">{PROVIDER_LABELS[provider]}</span>
                <span className="text-muted-foreground">{info}</span>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground mt-2 pt-2 border-t">
              동시 호출 수가 RPM 한도를 초과하면 429 에러가 발생합니다. 자동 재시도가 적용되지만, 지나치게 높으면 분석이 느려질 수 있습니다.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{label}</span>
        <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{value}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueCommit={([v]) => onCommit(v)}
      />
    </div>
  );
}
