'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LinkIcon, PlusIcon, XIcon } from 'lucide-react';
import { trpcClient } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface SeriesSelectorProps {
  keyword: string;
  onSeriesSelect: (seriesId: number | null, createNew: boolean) => void;
  selectedSeriesId: number | null;
  createNewSeries: boolean;
}

export function SeriesSelector({
  keyword,
  onSeriesSelect,
  selectedSeriesId,
  createNewSeries,
}: SeriesSelectorProps) {
  const [debouncedKeyword, setDebouncedKeyword] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  const { data: matchingSeries } = useQuery({
    queryKey: ['series', 'searchByKeyword', debouncedKeyword],
    queryFn: () => trpcClient.series.searchByKeyword.query({ keyword: debouncedKeyword }),
    enabled: debouncedKeyword.length >= 1,
    staleTime: 10_000,
  });

  const handleSelectSeries = useCallback(
    (seriesId: number) => {
      if (selectedSeriesId === seriesId) {
        onSeriesSelect(null, false);
      } else {
        onSeriesSelect(seriesId, false);
      }
    },
    [selectedSeriesId, onSeriesSelect],
  );

  const handleCreateNew = useCallback(
    (checked: boolean) => {
      onSeriesSelect(null, checked);
    },
    [onSeriesSelect],
  );

  if (!keyword) return null;

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">시리즈 연결</Label>

      {matchingSeries && matchingSeries.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            기존 시리즈에 연결하여 여론 변화를 추적할 수 있습니다
          </p>
          {matchingSeries.map((s) => (
            <Card
              key={s.id}
              className={`cursor-pointer transition-colors ${
                selectedSeriesId === s.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              }`}
              onClick={() => handleSelectSeries(s.id)}
            >
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-sm font-medium">{s.title ?? s.keyword}</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Badge variant="outline" className="text-xs">
                        {s.domain}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {(s.metadata as any)?.totalJobs ?? 0}회 분석
                      </span>
                    </div>
                  </div>
                </div>
                {selectedSeriesId === s.id && <XIcon className="h-4 w-4 text-muted-foreground" />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!selectedSeriesId && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="create-new-series"
            checked={createNewSeries}
            onCheckedChange={(checked) => handleCreateNew(!!checked)}
          />
          <Label htmlFor="create-new-series" className="text-sm cursor-pointer">
            <div className="flex items-center gap-1">
              <PlusIcon className="h-3.5 w-3.5" />새 시리즈 시작 (연속 모니터링)
            </div>
          </Label>
        </div>
      )}
    </div>
  );
}
