'use client';

import { SubscriptionPicker, type SubscriptionSummary } from '../subscription-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export interface KeywordInputProps {
  keyword: string;
  onKeywordChange: (value: string) => void;
  isSubMode: boolean;
  subscription: SubscriptionSummary | null;
  onSubscriptionSelect: (sub: SubscriptionSummary) => void;
  onSubscriptionClear: () => void;
  disabled: boolean;
}

export function KeywordInput({
  keyword,
  onKeywordChange,
  isSubMode,
  subscription,
  onSubscriptionSelect,
  onSubscriptionClear,
  disabled,
}: KeywordInputProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="keyword">키워드</Label>
      <div className="flex gap-2">
        <div className="flex flex-1 gap-2">
          <Input
            id="keyword"
            placeholder="인물 또는 키워드 입력"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            required
            maxLength={50}
            disabled={disabled || isSubMode}
            className="flex-1"
          />
          {isSubMode && subscription && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 text-xs gap-1"
              onClick={onSubscriptionClear}
              title="구독 모드 해제"
            >
              <span className="max-w-[120px] truncate">{subscription.keyword}</span>✕
            </Button>
          )}
        </div>
        {!isSubMode && <SubscriptionPicker onSelect={onSubscriptionSelect} disabled={disabled} />}
      </div>
    </div>
  );
}
