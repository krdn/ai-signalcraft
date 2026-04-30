'use client';

import { ChevronDown, HelpCircle, Lock } from 'lucide-react';
import { type OptimizationPreset, OPTIMIZATION_PRESETS, PRESET_STYLES } from '../trigger-form-data';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

export interface CollectionLimitsPanelProps {
  isDemo: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  disabled: boolean;
  isPerDay: boolean;
  maxNaverArticles: number;
  onMaxNaverArticlesChange: (v: number) => void;
  maxYoutubeVideos: number;
  onMaxYoutubeVideosChange: (v: number) => void;
  maxCommunityPosts: number;
  onMaxCommunityPostsChange: (v: number) => void;
  maxCommentsPerItem: number;
  onMaxCommentsPerItemChange: (v: number) => void;
  optimizationPreset: OptimizationPreset;
  onOptimizationPresetChange: (p: OptimizationPreset) => void;
}

export function CollectionLimitsPanel({
  isDemo,
  isOpen,
  onOpenChange,
  disabled,
  isPerDay,
  maxNaverArticles,
  onMaxNaverArticlesChange,
  maxYoutubeVideos,
  onMaxYoutubeVideosChange,
  maxCommunityPosts,
  onMaxCommunityPostsChange,
  maxCommentsPerItem,
  onMaxCommentsPerItemChange,
  optimizationPreset,
  onOptimizationPresetChange,
}: CollectionLimitsPanelProps) {
  const perDaySuffix = isPerDay
    ? ' 기간 모드에서는 이 값이 날짜별 한도이며, 실제 수집 총량 = 값 × 일수입니다.'
    : '';
  const sectionHeaderTooltip = isPerDay
    ? '수집할 데이터의 날짜별 수량과 AI 처리 전략을 설정합니다. 값을 줄이면 분석 비용과 시간이 절감됩니다.'
    : '수집할 데이터 양과 AI 처리 전략을 설정합니다. 값을 줄이면 분석 비용과 시간이 절감됩니다.';
  const limitsDescription = isPerDay
    ? '소스별 날짜당 수집 건수를 조절합니다. 줄이면 비용과 시간이 절약됩니다.'
    : '소스별 최대 수집 건수를 조절합니다. 줄이면 비용과 시간이 절약됩니다.';

  if (isDemo) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 text-sm text-muted-foreground flex items-center gap-2">
        <Lock className="h-4 w-4 shrink-0" />
        수집 한도 & 토큰 최적화: 데모 기본값 적용 (변경 불가)
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
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
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
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
                      수집할 네이버 뉴스 기사의 최대 건수입니다. 키워드와 기간에 따라 실제 수집량은
                      이보다 적을 수 있습니다.{perDaySuffix} (범위: 10 ~ 5,000건)
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
                  onChange={(e) => onMaxNaverArticlesChange(Number(e.target.value))}
                  disabled={disabled}
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
                  onChange={(e) => onMaxYoutubeVideosChange(Number(e.target.value))}
                  disabled={disabled}
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
                      DC갤러리·에펨코리아·클리앙 등 선택한 커뮤니티에서 수집할 게시글 수입니다.
                      {perDaySuffix} (범위: 5 ~ 500건)
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
                  onChange={(e) => onMaxCommunityPostsChange(Number(e.target.value))}
                  disabled={disabled}
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
                      각 기사/게시글/영상에서 수집할 댓글의 최대 건수입니다. 댓글은 AI 분석의 주요
                      여론 신호입니다. (범위: 10 ~ 2,000건)
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
                  onChange={(e) => onMaxCommentsPerItemChange(Number(e.target.value))}
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="border-t my-1" />

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
                  Object.entries(OPTIMIZATION_PRESETS).filter(([, p]) => p.group === 'classic') as [
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
                            onClick={() => onOptimizationPresetChange(key)}
                            disabled={disabled}
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
                  Object.entries(OPTIMIZATION_PRESETS).filter(([, p]) => p.group === 'rag') as [
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
                            onClick={() => onOptimizationPresetChange(key)}
                            disabled={disabled}
                            className={`rounded-md border p-2 text-center transition-colors w-full ${
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
                    PRESET_STYLES[optimizationPreset]?.border?.replace('border-', 'border-l-') ??
                    'border-l-zinc-500'
                  } ${
                    PRESET_STYLES[optimizationPreset]?.bg?.replace('/10', '/5') ?? 'bg-zinc-500/5'
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
  );
}
