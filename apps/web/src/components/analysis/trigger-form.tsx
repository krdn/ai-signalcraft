'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { Loader2, CalendarIcon } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';

interface TriggerFormProps {
  onJobStarted: (jobId: number) => void;
}

export function TriggerForm({ onJobStarted }: TriggerFormProps) {
  const [keyword, setKeyword] = useState('');
  const [sources, setSources] = useState<string[]>(['naver', 'youtube']);
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());

  const triggerMutation = useMutation({
    mutationFn: (input: {
      keyword: string;
      sources: ('naver' | 'youtube')[];
      startDate: string;
      endDate: string;
    }) => trpcClient.analysis.trigger.mutate(input),
    onSuccess: (data) => {
      toast.success('분석이 시작되었습니다');
      onJobStarted(data.jobId);
    },
    onError: () => {
      toast.error('분석 실행에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    },
  });

  const handleAllToggle = (checked: boolean) => {
    setSources(checked ? ['naver', 'youtube'] : []);
  };

  const handleSourceToggle = (source: string, checked: boolean) => {
    setSources((prev) =>
      checked ? [...prev, source] : prev.filter((s) => s !== source)
    );
  };

  const isAllSelected = sources.includes('naver') && sources.includes('youtube');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || sources.length === 0) return;

    triggerMutation.mutate({
      keyword: keyword.trim(),
      sources: sources as ('naver' | 'youtube')[],
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
  };

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">분석 실행</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 키워드 입력 */}
          <div className="space-y-2">
            <Label htmlFor="keyword">키워드</Label>
            <Input
              id="keyword"
              placeholder="인물 또는 키워드 입력"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              required
              maxLength={50}
              disabled={triggerMutation.isPending}
            />
          </div>

          {/* 소스 선택 */}
          <div className="space-y-2">
            <Label>소스</Label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={(checked) => handleAllToggle(!!checked)}
                  disabled={triggerMutation.isPending}
                />
                <span className="text-sm">전체</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={sources.includes('naver')}
                  onCheckedChange={(checked) => handleSourceToggle('naver', !!checked)}
                  disabled={triggerMutation.isPending}
                />
                <span className="text-sm">네이버</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={sources.includes('youtube')}
                  onCheckedChange={(checked) => handleSourceToggle('youtube', !!checked)}
                  disabled={triggerMutation.isPending}
                />
                <span className="text-sm">유튜브</span>
              </label>
            </div>
          </div>

          {/* 기간 선택 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>시작일</Label>
              <Popover>
                <PopoverTrigger className="w-full">
                  <Button variant="outline" className="w-full justify-start text-left font-normal" type="button">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, 'yyyy-MM-dd', { locale: ko })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    disabled={triggerMutation.isPending}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>종료일</Label>
              <Popover>
                <PopoverTrigger className="w-full">
                  <Button variant="outline" className="w-full justify-start text-left font-normal" type="button">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(endDate, 'yyyy-MM-dd', { locale: ko })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    disabled={triggerMutation.isPending}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* 실행 버튼 */}
          <Button
            type="submit"
            className="w-full"
            disabled={triggerMutation.isPending || !keyword.trim() || sources.length === 0}
          >
            {triggerMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                분석 중...
              </>
            ) : (
              '분석 실행'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
