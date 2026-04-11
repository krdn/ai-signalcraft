'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** 도메인별 표시 이름 + 색상 */
const DOMAIN_META: Record<string, { label: string; color: string }> = {
  political: { label: '정치', color: 'bg-blue-500/15 text-blue-600 border-blue-500/20' },
  fandom: { label: '팬덤', color: 'bg-violet-500/15 text-violet-600 border-violet-500/20' },
  pr: { label: 'PR/위기', color: 'bg-red-500/15 text-red-600 border-red-500/20' },
  corporate: { label: '기업평판', color: 'bg-sky-500/15 text-sky-600 border-sky-500/20' },
  policy: { label: '정책', color: 'bg-indigo-500/15 text-indigo-600 border-indigo-500/20' },
  finance: { label: '금융', color: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/20' },
  healthcare: { label: '헬스케어', color: 'bg-teal-500/15 text-teal-600 border-teal-500/20' },
  'public-sector': {
    label: '공공기관',
    color: 'bg-green-500/15 text-green-600 border-green-500/20',
  },
  education: { label: '교육', color: 'bg-cyan-500/15 text-cyan-600 border-cyan-500/20' },
  sports: { label: '스포츠', color: 'bg-orange-500/15 text-orange-600 border-orange-500/20' },
  legal: { label: '법률', color: 'bg-slate-500/15 text-slate-600 border-slate-500/20' },
  retail: { label: '유통', color: 'bg-pink-500/15 text-pink-600 border-pink-500/20' },
};

interface DomainBadgeProps {
  domain?: string | null;
  className?: string;
  size?: 'sm' | 'xs';
}

export function DomainBadge({ domain, className, size = 'xs' }: DomainBadgeProps) {
  if (!domain) return null;
  const meta = DOMAIN_META[domain];
  if (!meta) return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        'shrink-0 font-medium',
        size === 'xs' ? 'text-[9px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
        meta.color,
        className,
      )}
    >
      {meta.label}
    </Badge>
  );
}

/** 도메인 한글 이름 반환 */
export function getDomainLabel(domain?: string | null): string {
  if (!domain) return '';
  return DOMAIN_META[domain]?.label ?? domain;
}
