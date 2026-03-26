'use client';

import { useMemo } from 'react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import { HelpCircle, Loader2, RotateCcw, AlertTriangle } from 'lucide-react';

// 모듈 메타데이터: 이름, 설명, 분석 내용, 추천 모델, 비용 팁
type ModuleMeta = {
  name: string;
  description: string;
  analyzes: string[];
  recommended: { provider: string; model: string; reason: string };
  costTip: string;
};

const MODULE_META: Record<string, ModuleMeta> = {
  'macro-view': {
    name: '전체 여론 구조 분석',
    description: '수집된 전체 데이터를 바탕으로 여론의 거시적 구조와 흐름을 파악합니다.',
    analyzes: [
      '주요 이슈별 여론 분포 비율',
      '시간대별 여론 변화 트렌드',
      '플랫폼 간 여론 차이 비교',
      '핵심 키워드 및 토픽 클러스터링',
    ],
    recommended: { provider: 'openai', model: 'gpt-4o-mini', reason: '대량 텍스트 요약에 비용 효율적' },
    costTip: '데이터 양이 많아 토큰 소비가 큽니다. 비용 절감이 중요하면 경량 모델을 추천합니다.',
  },
  'segmentation': {
    name: '여론 진영 세분화',
    description: '여론 참여자를 성향, 관심사, 입장에 따라 세부 진영으로 분류합니다.',
    analyzes: [
      '지지/반대/중립 진영 분류 및 규모 추정',
      '진영별 핵심 주장과 논리 구조',
      '진영 간 대립 포인트 매핑',
      '이탈 가능성이 높은 유동층 식별',
    ],
    recommended: { provider: 'openai', model: 'gpt-4o-mini', reason: '패턴 분류 작업에 충분한 성능' },
    costTip: '분류 작업은 비교적 단순하므로 경량 모델로도 정확도가 높습니다.',
  },
  'sentiment-framing': {
    name: '감정 프레이밍 분석',
    description: '텍스트에 내재된 감정의 종류와 강도, 그리고 프레이밍 방식을 분석합니다.',
    analyzes: [
      '긍정/부정/분노/불안/희망 등 감정 분류',
      '감정 강도 수치화 (1~10 스케일)',
      '특정 이슈에 대한 프레이밍 전략 탐지',
      '감정 유발 키워드 및 표현 패턴 추출',
    ],
    recommended: { provider: 'openai', model: 'gpt-4o-mini', reason: '감정 분류에 비용 대비 성능 우수' },
    costTip: '한국어 뉘앙스 파악이 중요한 경우 고급 모델이 더 정확합니다.',
  },
  'message-impact': {
    name: '메시지 임팩트 분석',
    description: '특정 메시지나 발언이 여론에 미친 실제 영향력을 측정합니다.',
    analyzes: [
      '메시지 도달 범위 및 확산 속도 추정',
      '메시지 전후 여론 변화량 측정',
      '반응 유형 분류 (공감/반발/무관심)',
      '메시지 효과의 지속 기간 예측',
    ],
    recommended: { provider: 'openai', model: 'gpt-4o-mini', reason: '정량적 분석에 적합' },
    costTip: '시계열 비교가 포함되어 입력 토큰이 많을 수 있습니다.',
  },
  'risk-map': {
    name: '리스크 맵',
    description: '현재 여론 상황에서 잠재적 위험 요소를 식별하고 우선순위를 매깁니다.',
    analyzes: [
      '부정 여론 확산 위험도 평가',
      '이슈별 위기 발생 확률 예측',
      '위험 요소의 영향 범위 및 심각도 매트릭스',
      '조기 경보 신호 탐지',
    ],
    recommended: { provider: 'anthropic', model: 'claude-sonnet-4-20250514', reason: '복합적 위험 분석에 높은 추론 능력 필요' },
    costTip: '정확한 위험 평가가 중요하므로 고급 모델 사용을 권장합니다.',
  },
  'opportunity': {
    name: '기회 요소 분석',
    description: '여론 데이터에서 활용 가능한 긍정적 기회와 전략적 포인트를 발굴합니다.',
    analyzes: [
      '긍정 여론 강화 가능 포인트',
      '경쟁 대상 대비 우위 영역',
      '미디어 어젠다 선점 기회',
      '지지층 확대 가능 타겟 그룹 식별',
    ],
    recommended: { provider: 'anthropic', model: 'claude-sonnet-4-20250514', reason: '창의적 인사이트 도출에 강점' },
    costTip: '전략적 판단이 필요한 영역으로, 모델 품질이 결과에 직접 영향을 줍니다.',
  },
  'strategy': {
    name: '전략 제안',
    description: '분석 결과를 종합하여 실행 가능한 구체적 전략 방안을 제시합니다.',
    analyzes: [
      '단기/중기/장기 대응 전략 로드맵',
      '타겟별 맞춤 메시지 전략',
      '위기 대응 시나리오별 액션 플랜',
      '미디어 채널별 최적 커뮤니케이션 방안',
    ],
    recommended: { provider: 'anthropic', model: 'claude-sonnet-4-20250514', reason: '전략 수립에 깊은 추론 능력 필수' },
    costTip: '최종 의사결정에 활용되므로 가장 높은 품질의 모델을 추천합니다.',
  },
  'final-summary': {
    name: '최종 요약',
    description: '모든 분석 모듈의 결과를 하나의 통합 요약 보고서로 정리합니다.',
    analyzes: [
      '각 모듈 핵심 결론의 종합 정리',
      '우선순위별 주요 발견 사항',
      '즉시 대응 필요 항목 하이라이트',
      '의사결정자용 원페이지 브리핑',
    ],
    recommended: { provider: 'anthropic', model: 'claude-sonnet-4-20250514', reason: '다중 분석 결과 종합에 뛰어난 정리 능력' },
    costTip: '입력이 다른 모듈 결과 전체이므로 토큰 소비가 클 수 있습니다.',
  },
  'integrated-report': {
    name: '종합 리포트',
    description: '모든 분석 결과를 구조화된 전문 리포트 형태로 생성합니다.',
    analyzes: [
      '목차가 포함된 공식 보고서 형태 생성',
      '그래프/차트 데이터 포맷팅',
      '참고 데이터 원문 인용 및 출처 표기',
      '배포 가능한 최종 문서 형태 출력',
    ],
    recommended: { provider: 'anthropic', model: 'claude-sonnet-4-20250514', reason: '긴 형식의 구조화된 문서 생성에 최적' },
    costTip: '출력 토큰이 매우 많습니다. 비용에 민감하면 요약 수준을 조절하세요.',
  },
  'approval-rating': {
    name: '지지율 예측',
    description: '수집된 여론 데이터를 기반으로 지지율 변화를 예측합니다.',
    analyzes: [
      '현재 여론 기반 지지율 추정치',
      '향후 1~4주 지지율 변동 시나리오',
      '지지율 영향 핵심 변수 식별',
      '과거 유사 사례와의 패턴 비교',
    ],
    recommended: { provider: 'anthropic', model: 'claude-sonnet-4-20250514', reason: '수치 예측에 정밀한 추론 필요' },
    costTip: '정량적 예측의 정확도는 모델 성능에 크게 의존합니다.',
  },
  'frame-war': {
    name: '프레임 전쟁 분석',
    description: '각 진영이 사용하는 프레이밍 전략과 그 효과를 분석합니다.',
    analyzes: [
      '진영별 주요 프레임 식별 및 명명',
      '프레임 간 충돌 구조 매핑',
      '프레임 우세/열세 판단',
      '역프레이밍 전략 제안',
    ],
    recommended: { provider: 'anthropic', model: 'claude-sonnet-4-20250514', reason: '미묘한 언어 전략 분석에 고급 모델 필수' },
    costTip: '담론 분석은 컨텍스트 이해가 핵심이므로 모델 품질이 중요합니다.',
  },
  'crisis-scenario': {
    name: '위기 시나리오',
    description: '발생 가능한 위기 상황을 시나리오별로 예측하고 대응 방안을 수립합니다.',
    analyzes: [
      '최악/보통/최선 시나리오 시뮬레이션',
      '시나리오별 발생 확률 및 트리거 조건',
      '시나리오별 피해 규모 추정',
      '단계별 위기 대응 매뉴얼 생성',
    ],
    recommended: { provider: 'anthropic', model: 'claude-sonnet-4-20250514', reason: '복합 시나리오 생성에 고급 추론 필요' },
    costTip: '여러 시나리오를 생성하므로 출력 토큰이 많습니다.',
  },
  'win-simulation': {
    name: '승리 시뮬레이션',
    description: '목표 달성을 위한 최적 전략 경로를 시뮬레이션합니다.',
    analyzes: [
      '목표 지지율 달성을 위한 경로 모델링',
      '핵심 변수별 민감도 분석',
      '경쟁 대상 전략 대응 시뮬레이션',
      '최적 자원 배분 방안 제안',
    ],
    recommended: { provider: 'anthropic', model: 'claude-sonnet-4-20250514', reason: '게임 이론 기반 전략 시뮬레이션에 최고 성능 필요' },
    costTip: '가장 복잡한 분석 모듈입니다. 최고 품질 모델 사용을 강력 권장합니다.',
  },
};

// 프로바이더 표시명 매핑
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

type ModelSettingItem = {
  moduleName: string;
  provider: string;
  model: string;
  isCustom: boolean;
};

export function ModelSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: [['settings', 'list']],
    queryFn: () => trpcClient.settings.list.query(),
  });

  // API 키 관리에서 등록된 프로바이더/모델 정보 가져오기
  const { data: providerKeysList } = useQuery({
    queryKey: [['settings', 'providerKeys', 'list']],
    queryFn: () => trpcClient.settings.providerKeys.list.query(),
  });

  // 등록된 프로바이더 목록과 프로바이더별 모델 목록 구성
  const { availableProviders, providerModels } = useMemo(() => {
    if (!providerKeysList || providerKeysList.length === 0) {
      return { availableProviders: [] as string[], providerModels: {} as Record<string, string[]> };
    }

    const modelsMap: Record<string, Set<string>> = {};
    for (const key of providerKeysList) {
      if (!key.isActive) continue;
      if (!modelsMap[key.providerType]) {
        modelsMap[key.providerType] = new Set();
      }
      if (key.selectedModel) {
        modelsMap[key.providerType].add(key.selectedModel);
      }
    }

    const providers = Object.keys(modelsMap).sort();
    const models: Record<string, string[]> = {};
    for (const [provider, modelSet] of Object.entries(modelsMap)) {
      models[provider] = [...modelSet].sort();
    }

    return { availableProviders: providers, providerModels: models };
  }, [providerKeysList]);

  const updateMutation = useMutation({
    mutationFn: (input: { moduleName: string; provider: string; model: string }) =>
      trpcClient.settings.update.mutate(input as Parameters<typeof trpcClient.settings.update.mutate>[0]),
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
    // 프로바이더 변경 시 해당 프로바이더의 첫 번째 모델로 자동 변경
    const firstModel = providerModels[newProvider]?.[0] ?? '';
    updateMutation.mutate({
      moduleName: item.moduleName,
      provider: newProvider,
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
  const hasProviders = availableProviders.length > 0;

  return (
      <div className="space-y-3">
        {/* 등록된 API 키가 없으면 안내 */}
        {!hasProviders && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">등록된 API 키가 없습니다</p>
              <p className="mt-1">
                위의 <strong>API 키 관리</strong> 탭에서 프로바이더를 등록하고 모델을 선택(Test &amp; Select)해주세요.
                등록된 프로바이더와 모델이 여기에 자동으로 표시됩니다.
              </p>
            </div>
          </div>
        )}

        {settings.map((item) => {
          // 현재 설정된 모델이 등록된 목록에 있는지 확인
          const currentModels = providerModels[item.provider] ?? [];
          const isModelAvailable = currentModels.includes(item.model);

          return (
          <div
            key={item.moduleName}
            className="flex flex-col gap-2 rounded-lg border p-3"
          >
            {/* 모듈명 + 도움말 + 커스텀 뱃지 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">
                  {MODULE_META[item.moduleName]?.name ?? item.moduleName}
                </span>
                <ModuleHelpPopover moduleName={item.moduleName} />
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
                value={hasProviders && availableProviders.includes(item.provider) ? item.provider : undefined}
                onValueChange={(val) => handleProviderChange(item, val)}
                disabled={isPending || !hasProviders}
              >
                <SelectTrigger className="w-[130px]" size="sm">
                  <SelectValue placeholder={hasProviders ? '프로바이더' : '키 없음'} />
                </SelectTrigger>
                <SelectContent>
                  {availableProviders.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {PROVIDER_LABELS[provider] ?? provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={isModelAvailable ? item.model : undefined}
                onValueChange={(val) => handleModelChange(item, val)}
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

            {/* 현재 설정이 등록된 키와 맞지 않으면 경고 */}
            {item.isCustom && hasProviders && (!availableProviders.includes(item.provider) || !isModelAvailable) && (
              <p className="text-xs text-amber-500">
                현재 설정된 {!availableProviders.includes(item.provider) ? `프로바이더(${item.provider})` : `모델(${item.model})`}이(가)
                API 키 관리에 등록되지 않았습니다.
              </p>
            )}
          </div>
          );
        })}
      </div>
  );
}

function ModuleHelpPopover({ moduleName }: { moduleName: string }) {
  const meta = MODULE_META[moduleName];
  if (!meta) return null;

  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-80 p-0">
        <div className="space-y-3 p-4">
          {/* 설명 */}
          <p className="text-sm text-muted-foreground leading-relaxed">
            {meta.description}
          </p>

          {/* 분석 항목 */}
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

          {/* 추천 모델 */}
          <div className="rounded-md bg-muted/50 p-2.5">
            <p className="text-xs font-semibold text-foreground mb-1">추천 모델</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{meta.recommended.provider}</span>
              {' / '}
              <span className="font-mono text-[11px]">{meta.recommended.model}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">{meta.recommended.reason}</p>
          </div>

          {/* 비용 팁 */}
          <div className="flex items-start gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5">
            <span className="text-xs leading-none mt-0.5">💡</span>
            <p className="text-xs text-muted-foreground leading-relaxed">{meta.costTip}</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
