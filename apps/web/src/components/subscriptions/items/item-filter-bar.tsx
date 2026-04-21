'use client';

import { X } from 'lucide-react';
import { SOURCE_LABEL_MAP } from './item-utils';
import type { SubscriptionRecord } from '@/server/trpc/routers/subscriptions';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface FilterState {
  sources: string[];
  dateRange: { start: string; end: string };
}

interface ItemFilterBarProps {
  subscription: SubscriptionRecord | null | undefined;
  value: FilterState;
  onChange: (next: FilterState) => void;
  totalItems: number;
}

export function ItemFilterBar({ subscription, value, onChange, totalItems }: ItemFilterBarProps) {
  if (!subscription) {
    return <div className="p-4 text-sm text-muted-foreground">구독 정보 로드 중...</div>;
  }

  const handleSourceToggle = (source: string) => {
    const newSources = value.sources.includes(source)
      ? value.sources.filter((s) => s !== source)
      : [...value.sources, source];
    onChange({ ...value, sources: newSources });
  };

  const handleDateChange = (key: 'start' | 'end', val: string) => {
    // datetime-local input은 "YYYY-MM-DDTHH:mm" 형식
    // 이를 UTC 자정으로 해석하려면 "Z"를 명시해야 함
    // 예: "2026-03-22T00:00" → "2026-03-22T00:00:00Z"
    const isoString = `${val}:00Z`;
    onChange({
      ...value,
      dateRange: { ...value.dateRange, [key]: isoString },
    });
  };

  const handleReset = () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    onChange({
      sources: subscription.sources || [],
      dateRange: {
        start: thirtyDaysAgo.toISOString(),
        end: now.toISOString(),
      },
    });
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">필터</h3>
          <p className="text-xs text-muted-foreground">총 {totalItems}건</p>
        </div>
        <Button size="sm" variant="ghost" onClick={handleReset}>
          <X className="h-3.5 w-3.5 mr-1" /> 초기화
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium">소스</Label>
        <div className="space-y-1">
          {subscription.sources?.map((source) => (
            <div key={source} className="flex items-center gap-2">
              <Checkbox
                id={`source-${source}`}
                checked={value.sources.includes(source)}
                onCheckedChange={() => handleSourceToggle(source)}
              />
              <Label htmlFor={`source-${source}`} className="text-xs cursor-pointer">
                {SOURCE_LABEL_MAP[source] || source}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium">기간</Label>
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">시작:</span>
            <Input
              type="datetime-local"
              className="text-xs h-8 flex-1"
              value={value.dateRange.start.slice(0, 16)}
              onChange={(e) => handleDateChange('start', e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">종료:</span>
            <Input
              type="datetime-local"
              className="text-xs h-8 flex-1"
              value={value.dateRange.end.slice(0, 16)}
              onChange={(e) => handleDateChange('end', e.target.value)}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
