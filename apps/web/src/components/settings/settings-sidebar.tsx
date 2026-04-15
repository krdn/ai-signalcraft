'use client';

import { KeyRound, Bot, Zap, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SettingsSection =
  | 'provider-keys'
  | 'model-settings'
  | 'concurrency'
  | 'collection-limits';

type SidebarItem = {
  id: SettingsSection;
  icon: React.ElementType;
  label: string;
  showStatusDot?: boolean;
};

const SIDEBAR_GROUPS: { groupLabel: string; items: SidebarItem[] }[] = [
  {
    groupLabel: '연결',
    items: [
      { id: 'provider-keys', icon: KeyRound, label: 'API 키 & 프로바이더', showStatusDot: true },
    ],
  },
  {
    groupLabel: '분석 설정',
    items: [
      { id: 'model-settings', icon: Bot, label: '모듈별 모델' },
      { id: 'concurrency', icon: Zap, label: '병렬처리 & 속도' },
    ],
  },
  {
    groupLabel: '수집 설정',
    items: [{ id: 'collection-limits', icon: Package, label: '수집 한도' }],
  },
];

type Props = {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  hasProviderKeys: boolean;
};

export function SettingsSidebar({ activeSection, onSectionChange, hasProviderKeys }: Props) {
  return (
    <nav className="w-[200px] shrink-0 border-r bg-muted/20 py-4">
      {SIDEBAR_GROUPS.map((group) => (
        <div key={group.groupLabel} className="mb-1">
          <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            {group.groupLabel}
          </p>
          {group.items.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={cn(
                  'relative flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-colors text-left',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-0 h-full w-[3px] rounded-r bg-primary" />
                )}
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.showStatusDot && (
                  <span
                    className={cn(
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      hasProviderKeys ? 'bg-green-500' : 'bg-amber-500',
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
