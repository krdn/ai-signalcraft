'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { toast } from 'sonner';
import { Loader2, RotateCcw } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

// 모듈 한국어 이름 매핑
const MODULE_DISPLAY_NAMES: Record<string, string> = {
  'macro-view': '전체 여론 구조 분석',
  'segmentation': '여론 진영 세분화',
  'sentiment-framing': '감정 프레이밍 분석',
  'message-impact': '메시지 임팩트 분석',
  'risk-map': '리스크 맵',
  'opportunity': '기회 요소 분석',
  'strategy': '전략 제안',
  'final-summary': '최종 요약',
  'integrated-report': '종합 리포트',
  'approval-rating': '지지율 예측',
  'frame-war': '프레임 전쟁 분석',
  'crisis-scenario': '위기 시나리오',
  'win-simulation': '승리 시뮬레이션',
};

// 프로바이더별 사용 가능 모델 목록
const PROVIDER_MODELS: Record<string, string[]> = {
  anthropic: [
    'claude-sonnet-4-20250514',
    'claude-haiku-35-20241022',
  ],
  openai: [
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
  ],
};

type ModelSettingItem = {
  moduleName: string;
  provider: 'anthropic' | 'openai';
  model: string;
  isCustom: boolean;
};

export function ModelSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: [['settings', 'list']],
    queryFn: () => trpcClient.settings.list.query(),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { moduleName: string; provider: 'anthropic' | 'openai'; model: string }) =>
      trpcClient.settings.update.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['settings', 'list']] });
      toast.success('모델 설정이 변경되었습니다');
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? '설정 변경에 실패했습니다');
    },
  });

  const resetMutation = useMutation({
    mutationFn: (moduleName: string) =>
      trpcClient.settings.resetToDefault.mutate({ moduleName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['settings', 'list']] });
      toast.success('기본값으로 복원되었습니다');
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? '복원에 실패했습니다');
    },
  });

  const handleProviderChange = (item: ModelSettingItem, newProvider: string | null) => {
    if (!newProvider) return;
    const provider = newProvider as 'anthropic' | 'openai';
    // 프로바이더 변경 시 해당 프로바이더의 첫 번째 모델로 자동 변경
    const firstModel = PROVIDER_MODELS[provider]?.[0] ?? '';
    updateMutation.mutate({
      moduleName: item.moduleName,
      provider,
      model: firstModel,
    });
  };

  const handleModelChange = (item: ModelSettingItem, newModel: string | null) => {
    if (!newModel) return;
    updateMutation.mutate({
      moduleName: item.moduleName,
      provider: item.provider,
      model: newModel,
    });
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
    return (
      <div className="py-8 text-center text-muted-foreground">
        설정을 불러올 수 없습니다.
      </div>
    );
  }

  const isPending = updateMutation.isPending || resetMutation.isPending;

  return (
    <ScrollArea className="max-h-[70vh]">
      <div className="space-y-3 pr-4">
        {settings.map((item) => (
          <div
            key={item.moduleName}
            className="flex flex-col gap-2 rounded-lg border p-3"
          >
            {/* 모듈명 + 커스텀 뱃지 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {MODULE_DISPLAY_NAMES[item.moduleName] ?? item.moduleName}
                </span>
                {item.isCustom && (
                  <Badge variant="secondary" className="text-[10px]">
                    사용자 설정
                  </Badge>
                )}
              </div>
              {item.isCustom && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  disabled={isPending}
                  onClick={() => resetMutation.mutate(item.moduleName)}
                >
                  <RotateCcw className="mr-1 h-3 w-3" />
                  기본값
                </Button>
              )}
            </div>

            {/* 프로바이더 + 모델 선택 */}
            <div className="flex items-center gap-2">
              <Select
                value={item.provider}
                onValueChange={(val) => handleProviderChange(item, val)}
                disabled={isPending}
              >
                <SelectTrigger className="w-[130px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={item.model}
                onValueChange={(val) => handleModelChange(item, val)}
                disabled={isPending}
              >
                <SelectTrigger className="flex-1" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(PROVIDER_MODELS[item.provider] ?? []).map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
