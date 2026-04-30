'use client';

import { type SourceId, SOURCE_OPTIONS, ALL_SOURCES } from '../trigger-form-data';
import { trpcClient } from '@/lib/trpc';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

// tRPC 응답 shape 직접 추론 — schema drift 시 컴파일 에러로 조기 발견
type CustomSource = NonNullable<
  Awaited<ReturnType<typeof trpcClient.admin.sources.listEnabled.query>>
>[number];

export interface SourceSelectorProps {
  sources: SourceId[];
  customSourceIds: string[];
  customSources: CustomSource[] | undefined;
  isSubMode: boolean;
  isDemo: boolean;
  disabled: boolean;
  onAllToggle: (checked: boolean) => void;
  onSourceToggle: (source: SourceId, checked: boolean) => void;
  onCustomSourceToggle: (id: string, checked: boolean) => void;
}

export function SourceSelector({
  sources,
  customSourceIds,
  customSources,
  isSubMode,
  isDemo,
  disabled,
  onAllToggle,
  onSourceToggle,
  onCustomSourceToggle,
}: SourceSelectorProps) {
  const isAllSelected = ALL_SOURCES.every((s) => sources.includes(s));

  return (
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
            onCheckedChange={(checked) => onAllToggle(!!checked)}
            disabled={disabled || isSubMode}
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
                    onCheckedChange={(checked) => onSourceToggle(item.id, !!checked)}
                    disabled={disabled || isSubMode}
                  />
                  <span className="text-sm">{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        {/* 사용자 정의 소스 */}
        {customSources && customSources.length > 0 && !isDemo && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">사용자 정의 소스</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-2">
              {customSources.map((cs) => (
                <label key={cs.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={customSourceIds.includes(cs.id)}
                    onCheckedChange={(checked) => onCustomSourceToggle(cs.id, !!checked)}
                    disabled={disabled || isSubMode}
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
  );
}
