'use client';

import type { SourceId } from '../trigger-form-data';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export interface AnalysisOptionsProps {
  isDemo: boolean;
  isSubMode: boolean;
  disabled: boolean;
  enableItemAnalysis: boolean;
  onEnableItemAnalysisChange: (v: boolean) => void;
  collectTranscript: boolean;
  onCollectTranscriptChange: (v: boolean) => void;
  sources: SourceId[];
}

export function AnalysisOptions({
  isDemo,
  isSubMode,
  disabled,
  enableItemAnalysis,
  onEnableItemAnalysisChange,
  collectTranscript,
  onCollectTranscriptChange,
  sources,
}: AnalysisOptionsProps) {
  return (
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
          onCheckedChange={(checked) => onEnableItemAnalysisChange(!!checked)}
          disabled={isDemo || disabled || isSubMode}
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
            onCheckedChange={(checked) => onCollectTranscriptChange(!!checked)}
            disabled={isDemo || disabled || isSubMode}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <span className="text-sm font-medium">유튜브 자막 수집</span>
            <p className="text-xs text-muted-foreground">
              영상 자막을 수집합니다. YouTube 자막이 없는 영상은 조회수 상위 20건에 한해 오디오를
              자동 전사(Whisper)해 채웁니다. 다음 분석 실행부터 반영됩니다.
            </p>
          </div>
        </label>
      )}
    </div>
  );
}
