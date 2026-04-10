'use client';

import { CalendarDays, Clock, Layers, MessageSquare, Newspaper } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { SOURCE_LABELS, SENTIMENT_CONFIG } from '@/components/dashboard/collected-data-shared';
import { cn } from '@/lib/utils';

export type SentimentKey = 'positive' | 'negative' | 'neutral';
export type ItemType = 'articles' | 'comments' | 'both';

export type DateScope = 'job' | 'all';

export interface ExploreFilterState {
  sources: string[];
  sentiments: SentimentKey[];
  minScore: number;
  itemType: ItemType;
  dateScope: DateScope;
}

export const DEFAULT_FILTERS: ExploreFilterState = {
  sources: [],
  sentiments: [],
  minScore: 0,
  itemType: 'both',
  dateScope: 'job',
};

interface ExploreFiltersProps {
  value: ExploreFilterState;
  onChange: (next: ExploreFilterState) => void;
}

const SOURCE_KEYS = Object.keys(SOURCE_LABELS);
const SENTIMENT_KEYS: SentimentKey[] = ['positive', 'negative', 'neutral'];

export function ExploreFilters({ value, onChange }: ExploreFiltersProps) {
  const toggleSource = (source: string) => {
    const next = value.sources.includes(source)
      ? value.sources.filter((s) => s !== source)
      : [...value.sources, source];
    onChange({ ...value, sources: next });
  };

  const toggleSentiment = (s: SentimentKey) => {
    const next = value.sentiments.includes(s)
      ? value.sentiments.filter((x) => x !== s)
      : [...value.sentiments, s];
    onChange({ ...value, sentiments: next });
  };

  const setItemType = (t: ItemType) => onChange({ ...value, itemType: t });
  const setMinScore = (n: number) => onChange({ ...value, minScore: n });
  const reset = () => onChange(DEFAULT_FILTERS);

  const hasActive =
    value.sources.length > 0 ||
    value.sentiments.length > 0 ||
    value.minScore > 0 ||
    value.itemType !== 'both' ||
    value.dateScope !== 'job';

  return (
    <Card className="sticky top-14 z-10 border-border/60 bg-card/95 backdrop-blur">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
          {/* 소스 */}
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              소스
            </span>
            <div className="flex flex-wrap items-center gap-3">
              {SOURCE_KEYS.map((src) => {
                const checked = value.sources.includes(src);
                return (
                  <label
                    key={src}
                    className="flex items-center gap-1.5 cursor-pointer text-xs select-none"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleSource(src)}
                      aria-label={`${SOURCE_LABELS[src]} 필터`}
                    />
                    <span className={cn(checked && 'text-foreground font-medium')}>
                      {SOURCE_LABELS[src]}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 감정 */}
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              감정
            </span>
            <div className="flex items-center gap-1.5">
              {SENTIMENT_KEYS.map((s) => {
                const active = value.sentiments.includes(s);
                const cfg = SENTIMENT_CONFIG[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSentiment(s)}
                    className={cn(
                      'px-2.5 py-1 rounded-md border text-xs font-medium transition-all',
                      active
                        ? cfg.className
                        : 'border-border bg-transparent text-muted-foreground hover:text-foreground',
                    )}
                    aria-pressed={active}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 항목 타입 */}
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              항목
            </span>
            <div className="flex items-center gap-1">
              <ItemTypeButton
                active={value.itemType === 'both'}
                onClick={() => setItemType('both')}
                icon={<Layers className="h-3 w-3" />}
                label="전체"
              />
              <ItemTypeButton
                active={value.itemType === 'articles'}
                onClick={() => setItemType('articles')}
                icon={<Newspaper className="h-3 w-3" />}
                label="기사"
              />
              <ItemTypeButton
                active={value.itemType === 'comments'}
                onClick={() => setItemType('comments')}
                icon={<MessageSquare className="h-3 w-3" />}
                label="댓글"
              />
            </div>
          </div>

          {/* 기간 범위 */}
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              기간
            </span>
            <div className="flex items-center gap-1">
              <ItemTypeButton
                active={value.dateScope === 'job'}
                onClick={() => onChange({ ...value, dateScope: 'job' })}
                icon={<Clock className="h-3 w-3" />}
                label="수집 기간"
              />
              <ItemTypeButton
                active={value.dateScope === 'all'}
                onClick={() => onChange({ ...value, dateScope: 'all' })}
                icon={<CalendarDays className="h-3 w-3" />}
                label="전체 기간"
              />
            </div>
          </div>

          {/* 최소 확신도 */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                최소 확신도
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                ≥ {(value.minScore * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[value.minScore]}
              onValueChange={(v) => setMinScore(v[0] ?? 0)}
              min={0}
              max={1}
              step={0.05}
              aria-label="최소 확신도"
            />
          </div>

          {/* 리셋 */}
          {hasActive && (
            <div className="flex flex-col justify-end">
              <Button variant="ghost" size="sm" onClick={reset} className="text-xs h-8">
                초기화
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ItemTypeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors border',
        active
          ? 'bg-primary/10 text-primary border-primary/30'
          : 'border-border text-muted-foreground hover:text-foreground',
      )}
      aria-pressed={active}
    >
      {icon}
      {label}
    </button>
  );
}
