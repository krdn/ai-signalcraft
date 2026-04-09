'use client';

import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PresetCardProps {
  title: string;
  description: string;
  icon: string;
  highlight?: string | null;
  onClick: () => void;
}

function getIcon(name: string): LucideIcon {
  const Icon = (LucideIcons as unknown as Record<string, LucideIcon>)[name];
  return Icon ?? LucideIcons.HelpCircle;
}

export function PresetCard({ title, description, icon, highlight, onClick }: PresetCardProps) {
  const Icon = getIcon(icon);

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
          <div className="rounded-lg bg-primary/10 p-2 shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm leading-tight">{title}</h3>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</p>
          </div>
        </div>
        {highlight && (
          <div className="text-[11px] text-primary/80 flex items-center gap-1">
            <LucideIcons.Zap className="h-3 w-3 shrink-0" />
            {highlight}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
