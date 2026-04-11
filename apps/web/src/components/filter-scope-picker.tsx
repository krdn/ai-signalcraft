'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User, Users, Globe } from 'lucide-react';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export type ScopeMode = 'mine' | 'team' | 'all' | 'user';

export type FilterScopeValue = {
  scope: ScopeMode;
  targetUserId?: string;
};

interface FilterScopePickerProps {
  value: FilterScopeValue;
  onChange: (next: FilterScopeValue) => void;
  /**
   * 'all' 세그먼트 노출 여부 (super_admin 전용)
   * undefined이면 서버(listScopeUsers.isSuperAdmin)가 판단한 값을 사용
   */
  allowAllScope?: boolean;
  /** 드롭다운에 표시할 사용자 목록 조회 스코프 */
  usersScope?: 'team' | 'all';
  /** 세그먼트 버튼 크기 */
  size?: 'sm' | 'default';
}

type ScopeUser = {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  systemRole: string | null;
};

// 역할 → 한국어 라벨
const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  leader: 'Leader',
  sales: 'Sales',
  partner: 'Partner',
  member: 'Member',
  demo: 'Demo',
};

function getRoleBadge(u: ScopeUser): { label: string; tone: string } | null {
  if (u.systemRole === 'super_admin') {
    return { label: 'SUPER', tone: 'bg-violet-500/15 text-violet-500 border-violet-500/20' };
  }
  if (u.role) {
    const label = ROLE_LABEL[u.role] ?? u.role;
    if (u.role === 'admin' || u.role === 'leader') {
      return { label, tone: 'bg-blue-500/15 text-blue-500 border-blue-500/20' };
    }
    return { label, tone: 'bg-muted text-muted-foreground border-muted-foreground/20' };
  }
  return null;
}

/**
 * 권한자 전용 필터 스코프 선택 컴포넌트.
 *
 * - 세그먼트: [내것만] [전체] (+ super_admin은 [시스템 전체])
 * - 사용자 드롭다운: 특정 사용자 선택 시 scope='user'로 자동 전환
 * - member 등 일반 사용자에게는 노출하지 않음 (호출 측이 판단)
 */
export function FilterScopePicker({
  value,
  onChange,
  allowAllScope,
  usersScope = 'team',
  size = 'sm',
}: FilterScopePickerProps) {
  const { data: usersData } = useQuery({
    queryKey: ['history', 'scopeUsers', { scope: usersScope }],
    queryFn: () => trpcClient.history.listScopeUsers.query({ scope: usersScope }),
    staleTime: 60 * 1000,
  });

  const users = useMemo<ScopeUser[]>(() => usersData?.users ?? [], [usersData]);
  const showAllButton = allowAllScope ?? usersData?.isSuperAdmin ?? false;

  const selectedUser = useMemo(
    () => (value.scope === 'user' ? users.find((u) => u.id === value.targetUserId) : undefined),
    [users, value],
  );

  const btnHeight = size === 'sm' ? 'h-7' : 'h-8';

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* 세그먼트 */}
      <div className="flex items-center gap-0.5 rounded-md border p-0.5">
        <Button
          variant={value.scope === 'mine' ? 'default' : 'ghost'}
          size="sm"
          className={`${btnHeight} px-2.5 text-xs`}
          onClick={() => onChange({ scope: 'mine' })}
        >
          <User className="h-3.5 w-3.5 mr-1" />내 분석
        </Button>
        <Button
          variant={value.scope === 'team' ? 'default' : 'ghost'}
          size="sm"
          className={`${btnHeight} px-2.5 text-xs`}
          onClick={() => onChange({ scope: 'team' })}
        >
          <Users className="h-3.5 w-3.5 mr-1" />팀 전체
        </Button>
        {showAllButton && (
          <Button
            variant={value.scope === 'all' ? 'default' : 'ghost'}
            size="sm"
            className={`${btnHeight} px-2.5 text-xs`}
            onClick={() => onChange({ scope: 'all' })}
          >
            <Globe className="h-3.5 w-3.5 mr-1" />
            시스템 전체
          </Button>
        )}
      </div>

      {/* 사용자 드롭다운 */}
      <Select
        value={value.scope === 'user' ? (value.targetUserId ?? '') : ''}
        onValueChange={(val) => {
          if (!val) {
            // 해제 시 팀 전체로 폴백
            onChange({ scope: 'team' });
            return;
          }
          onChange({ scope: 'user', targetUserId: val });
        }}
      >
        <SelectTrigger className={`${btnHeight} w-[180px] text-xs`} size="sm">
          <SelectValue placeholder="사용자 선택…">
            {selectedUser && (
              <span className="inline-flex items-center gap-1.5 truncate">
                <User className="h-3 w-3 shrink-0" />
                <span className="truncate">{selectedUser.name}</span>
                {(() => {
                  const b = getRoleBadge(selectedUser);
                  return b ? (
                    <Badge className={`text-[9px] px-1 ${b.tone}`}>{b.label}</Badge>
                  ) : null;
                })()}
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {users.length === 0 ? (
            <div className="py-6 px-2 text-center text-xs text-muted-foreground">
              표시할 사용자가 없습니다
            </div>
          ) : (
            users.map((u) => {
              const badge = getRoleBadge(u);
              return (
                <SelectItem key={u.id} value={u.id}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="truncate">{u.name}</span>
                    {badge && (
                      <Badge className={`text-[9px] px-1 ${badge.tone}`}>{badge.label}</Badge>
                    )}
                  </span>
                </SelectItem>
              );
            })
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
