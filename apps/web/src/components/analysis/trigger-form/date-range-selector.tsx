'use client';

import { format, subDays, addDays } from 'date-fns';
import { Lock } from 'lucide-react';
import { DATE_PRESETS } from '../trigger-form-data';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export interface DateRangeSelectorProps {
  isDemo: boolean;
  isMounted: boolean;
  disabled: boolean;
  dateMode: 'period' | 'event';
  onDateModeChange: (mode: 'period' | 'event') => void;
  startDate: Date;
  endDate: Date;
  onStartDateChange: (d: Date) => void;
  onEndDateChange: (d: Date) => void;
  eventName: string;
  onEventNameChange: (v: string) => void;
  eventDate: Date;
  onEventDateChange: (d: Date) => void;
  eventRadius: number;
  onEventRadiusChange: (r: number) => void;
}

export function DateRangeSelector({
  isDemo,
  isMounted,
  disabled,
  dateMode,
  onDateModeChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  eventName,
  onEventNameChange,
  eventDate,
  onEventDateChange,
  eventRadius,
  onEventRadiusChange,
}: DateRangeSelectorProps) {
  return (
    <>
      {isDemo && (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 text-sm text-muted-foreground flex items-center gap-2">
          <Lock className="h-4 w-4 shrink-0" />
          기간: 최근 7일 고정 (데모 체험)
        </div>
      )}
      <Tabs
        value={dateMode}
        onValueChange={(v) => !isDemo && onDateModeChange(v as 'period' | 'event')}
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
                  disabled={disabled}
                  onClick={() => {
                    const { start, end } = preset.getDates();
                    onStartDateChange(start);
                    onEndDateChange(end);
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
                onChange={(e) => e.target.value && onStartDateChange(new Date(e.target.value))}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>종료일</Label>
              <input
                type="date"
                className="flex h-9 w-full rounded-lg border bg-card px-3 text-sm"
                value={isMounted ? format(endDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => e.target.value && onEndDateChange(new Date(e.target.value))}
                disabled={disabled}
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
              onChange={(e) => onEventNameChange(e.target.value)}
              disabled={disabled}
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
                onChange={(e) => e.target.value && onEventDateChange(new Date(e.target.value))}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eventRadius">전후 분석 범위</Label>
              <div className="flex items-center gap-2">
                <select
                  id="eventRadius"
                  value={eventRadius}
                  onChange={(e) => onEventRadiusChange(Number(e.target.value))}
                  disabled={disabled}
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
    </>
  );
}
