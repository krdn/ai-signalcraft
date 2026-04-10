'use client';

import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PresetCardProps {
  title: string;
  description: string;
  icon: string;
  highlight?: string | null;
  domain?: string;
  skippedModules?: string[];
  totalModules?: number;
  onClick: () => void;
}

function getIcon(name: string): LucideIcon {
  const Icon = (LucideIcons as unknown as Record<string, LucideIcon>)[name];
  return Icon ?? LucideIcons.HelpCircle;
}

export function PresetCard({
  title,
  description,
  icon,
  highlight,
  domain,
  skippedModules,
  totalModules,
  onClick,
}: PresetCardProps) {
  const Icon = getIcon(icon);
  const isFandom = domain === 'fandom';
  const activeModules = totalModules ? totalModules - (skippedModules?.length ?? 0) : null;

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:border-primary/50 hover:shadow-md',
        'group relative overflow-hidden',
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'rounded-lg p-2 shrink-0',
              isFandom ? 'bg-violet-500/10' : 'bg-primary/10',
            )}
          >
            <Icon className={cn('h-5 w-5', isFandom ? 'text-violet-500' : 'text-primary')} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-sm leading-tight">{title}</h3>
              {domain && (
                <Badge
                  className={cn(
                    'text-[9px] px-1.5 py-0',
                    isFandom
                      ? 'bg-violet-500/15 text-violet-500 border-violet-500/20'
                      : 'bg-blue-500/15 text-blue-500 border-blue-500/20',
                  )}
                >
                  {isFandom ? '팬덤' : '정치'}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          {highlight ? (
            <div className="text-[11px] text-primary/80 flex items-center gap-1">
              <LucideIcons.Zap className="h-3 w-3 shrink-0" />
              {highlight}
            </div>
          ) : (
            <span />
          )}
          {activeModules != null && (
            <span className="text-[10px] text-muted-foreground">{activeModules}개 모듈</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
