'use client';

import { Newspaper, Video, Users, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LimitCell {
  limit: number;
  actual: number;
  pct: number;
}

interface CommentLimitCell extends LimitCell {
  actualAvg: number;
  actualMax: number;
}

interface Props {
  limits: {
    naverArticles: LimitCell;
    youtubeVideos: LimitCell;
    communityPosts: LimitCell;
    commentsPerItem: CommentLimitCell;
  };
  limitsSource: 'job' | 'default';
  limitMode?: 'perDay' | 'total';
  dayCount?: number;
  rawLimits?: {
    naverArticles: number;
    youtubeVideos: number;
    communityPosts: number;
    commentsPerItem: number;
  };
  activeCommunityCount?: number;
}

function barColor(pct: number, hasLimit: boolean): string {
  if (!hasLimit) return 'bg-muted-foreground/40';
  if (pct >= 100) return 'bg-amber-500';
  if (pct >= 80) return 'bg-emerald-500';
  return 'bg-blue-500';
}

interface RowProps {
  icon: LucideIcon;
  label: string;
  actualText: string;
  limitText: string;
  pct: number;
  hasLimit: boolean;
}

function LimitRow({ icon: Icon, label, actualText, limitText, pct, hasLimit }: RowProps) {
  const displayPct = Math.min(100, Math.max(0, pct));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-medium shrink-0">{label}</span>
        <span className="flex-1" />
        <span className="text-xs tabular-nums text-muted-foreground">
          {actualText} <span className="mx-0.5">/</span>{' '}
          <span className="text-foreground">{limitText}</span>
          {hasLimit && (
            <span className="ml-1.5 inline-block min-w-[44px] text-right font-medium text-foreground">
              {pct.toFixed(1)}%
            </span>
          )}
          {!hasLimit && <span className="ml-1.5 text-foreground">한도 없음</span>}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full transition-all ${barColor(pct, hasLimit)}`}
          style={{ width: `${displayPct}%` }}
        />
      </div>
    </div>
  );
}

export function LimitProgress({
  limits,
  limitsSource,
  limitMode,
  dayCount,
  rawLimits,
  activeCommunityCount,
}: Props) {
  const fmt = (n: number) => n.toLocaleString('ko-KR');
  const isPerDay = limitMode === 'perDay' && (dayCount ?? 1) > 1;

  const limitLabel = (effective: number, raw?: number, sourceMultiplier = 1): string => {
    if (isPerDay && raw !== undefined && dayCount !== undefined) {
      const multiplierText = sourceMultiplier > 1 ? ` × ${sourceMultiplier}매체` : '';
      return `${fmt(effective)} (${fmt(raw)}/일 × ${dayCount}일${multiplierText})`;
    }
    if (sourceMultiplier > 1 && raw !== undefined) {
      return `${fmt(effective)} (${fmt(raw)} × ${sourceMultiplier}매체)`;
    }
    return fmt(effective);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          수집 한도 대비 실제
          {isPerDay && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              (날짜별 한도 × {dayCount}일 환산)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <LimitRow
          icon={Newspaper}
          label="네이버 뉴스"
          actualText={fmt(limits.naverArticles.actual)}
          limitText={limitLabel(limits.naverArticles.limit, rawLimits?.naverArticles)}
          pct={limits.naverArticles.pct}
          hasLimit={limits.naverArticles.limit > 0}
        />
        <LimitRow
          icon={Video}
          label="유튜브 영상"
          actualText={fmt(limits.youtubeVideos.actual)}
          limitText={limitLabel(limits.youtubeVideos.limit, rawLimits?.youtubeVideos)}
          pct={limits.youtubeVideos.pct}
          hasLimit={limits.youtubeVideos.limit > 0}
        />
        <LimitRow
          icon={Users}
          label="커뮤니티 게시글"
          actualText={fmt(limits.communityPosts.actual)}
          limitText={limitLabel(
            limits.communityPosts.limit,
            rawLimits?.communityPosts,
            activeCommunityCount ?? 1,
          )}
          pct={limits.communityPosts.pct}
          hasLimit={limits.communityPosts.limit > 0}
        />

        {/* 1건당 댓글 — 평균 / 최대 특수 표시 */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium shrink-0">1건당 댓글</span>
            <span className="flex-1" />
            <span className="text-xs tabular-nums text-muted-foreground">
              평균 <span className="text-foreground">{fmt(limits.commentsPerItem.actualAvg)}</span>{' '}
              / 한도 <span className="text-foreground">{fmt(limits.commentsPerItem.limit)}</span>
              <span className="mx-1">·</span>
              최대 <span className="text-foreground">{fmt(limits.commentsPerItem.actualMax)}</span>
              {limits.commentsPerItem.limit > 0 && (
                <span className="ml-1.5 min-w-[44px] text-right font-medium text-foreground">
                  {limits.commentsPerItem.pct.toFixed(1)}%
                </span>
              )}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-all ${barColor(
                limits.commentsPerItem.pct,
                limits.commentsPerItem.limit > 0,
              )}`}
              style={{
                width: `${Math.min(100, Math.max(0, limits.commentsPerItem.pct))}%`,
              }}
            />
          </div>
        </div>

        {limitsSource === 'default' && (
          <p className="text-xs text-muted-foreground pt-1">
            이 작업에 저장된 한도가 없어 시스템 기본값을 표시합니다.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
