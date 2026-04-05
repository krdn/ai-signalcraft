'use client';

import { User, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type FilterMode = 'mine' | 'team';

interface FilterModeToggleProps {
  value: FilterMode;
  onChange: (mode: FilterMode) => void;
}

export function FilterModeToggle({ value, onChange }: FilterModeToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-md border p-0.5">
      <Button
        variant={value === 'mine' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 px-2.5 text-xs"
        onClick={() => onChange('mine')}
      >
        <User className="h-3.5 w-3.5 mr-1" />내 분석
      </Button>
      <Button
        variant={value === 'team' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 px-2.5 text-xs"
        onClick={() => onChange('team')}
      >
        <Users className="h-3.5 w-3.5 mr-1" />팀 전체
      </Button>
    </div>
  );
}
