'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  MessageSquare,
  FlaskConical,
  Hash,
  Clock,
  ArrowRight,
  CheckCircle2,
  SkipForward,
  ChevronRight,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { trpcClient } from '@/lib/trpc';
import { cn } from '@/lib/utils';

interface ShowcaseDetailPanelProps {
  jobId: number;
  onClose: () => void;
  /** 페이지 내장 모드 (닫기 버튼/CTA 숨김, 카드 스타일 제거) */
  embedded?: boolean;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

function formatTokens(tokens: number) {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
  return String(tokens);
}

export function ShowcaseDetailPanel({ jobId, onClose, embedded }: ShowcaseDetailPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['showcase', 'getDetail', jobId],
    queryFn: () => trpcClient.showcase.getDetail.query({ jobId }),
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <div className="mt-4 rounded-2xl border border-border/50 bg-background/60 backdrop-blur-xl p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-12 w-full" />
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const maxSourceCount = Math.max(...data.sources.map((s) => s.articles + s.comments), 1);

  // Stage별 모듈 그룹핑
  const stageGroups = data.analysisModules.reduce(
    (acc, mod) => {
      if (!acc[mod.stage]) acc[mod.stage] = { label: mod.stageLabel, modules: [] };
      acc[mod.stage].modules.push(mod);
      return acc;
    },
    {} as Record<number, { label: string; modules: typeof data.analysisModules }>,
  );

  return (
    <div
      className={cn(
        'overflow-hidden',
        embedded
          ? ''
          : 'mt-4 rounded-2xl border border-border/50 bg-background/60 backdrop-blur-xl animate-in slide-in-from-top-2 fade-in duration-300',
      )}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <Badge className="bg-gradient-to-r from-primary/80 to-primary text-primary-foreground border-0 text-sm">
            {data.keyword}
          </Badge>
          <Badge
            variant="outline"
            className="gap-1 text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800"
          >
            <CheckCircle2 className="h-3 w-3" />
            완료
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(data.stats.durationSeconds)}
          </span>
          {!embedded && (
            <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* 통계 바 */}
      <div className="px-6 pb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={FileText} label="본문" value={data.stats.totalArticles} />
          <StatCard icon={MessageSquare} label="댓글" value={data.stats.totalComments} />
          <StatCard
            icon={FlaskConical}
            label="분석"
            value={`${data.stats.modulesCompleted}/${data.stats.modulesTotal}`}
          />
          <StatCard icon={Hash} label="토큰" value={formatTokens(data.stats.totalTokens)} />
        </div>
      </div>

      {/* 파이프라인 흐름 */}
      <div className="px-6 pb-4">
        <div className="flex items-center gap-1 overflow-x-auto py-1">
          {data.pipelineStages.map((stage, idx) => (
            <div key={stage.key} className="flex items-center shrink-0">
              <div
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                  stage.status === 'completed'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {stage.status === 'completed' ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <SkipForward className="h-3 w-3" />
                )}
                {stage.label}
              </div>
              {idx < data.pipelineStages.length - 1 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 mx-0.5 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 소스 + 모듈 2열 레이아웃 */}
      <div className="px-6 pb-5 grid md:grid-cols-2 gap-5">
        {/* 소스별 수집 */}
        <div>
          <h4 className="text-sm font-semibold mb-3 text-muted-foreground">데이터 수집</h4>
          <div className="space-y-2.5">
            {data.sources.map((src) => {
              const total = src.articles + src.comments;
              const ratio = total / maxSourceCount;
              return (
                <div key={src.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{src.label}</span>
                    <span className="text-muted-foreground">
                      {src.articles > 0 && <>{src.articles}건</>}
                      {src.articles > 0 && src.comments > 0 && ' · '}
                      {src.comments > 0 && <>{src.comments}댓글</>}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
                      style={{ width: `${Math.max(ratio * 100, 4)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI 분석 모듈 */}
        <div>
          <h4 className="text-sm font-semibold mb-3 text-muted-foreground">
            AI 분석{' '}
            <span className="font-normal">
              {data.stats.modulesCompleted}/{data.stats.modulesTotal} (100%)
            </span>
          </h4>
          <div className="space-y-4">
            {Object.entries(stageGroups)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([stage, group]) => (
                <div key={stage}>
                  <p className="text-xs text-muted-foreground mb-1.5">{group.label}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {group.modules.map((mod) => (
                      <div
                        key={mod.module}
                        className="rounded-lg border border-border/40 bg-muted/30 px-2.5 py-2 space-y-0.5"
                      >
                        <p className="text-xs font-medium truncate" title={mod.label}>
                          {mod.label}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span className="truncate">{mod.provider}</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span>{formatTokens(mod.totalTokens)}</span>
                          {mod.durationSeconds !== null && (
                            <>
                              <span className="text-muted-foreground/40">·</span>
                              <span>{formatDuration(mod.durationSeconds)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* CTA (embedded 모드에서는 숨김) */}
      {!embedded && (
        <div className="px-6 py-4 border-t border-border/30 text-center">
          <Link href="/demo">
            <Button size="sm" className="gap-1.5">
              무료 체험으로 직접 분석해 보세요
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/30 bg-muted/20 px-3 py-2.5">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div>
        <p className="text-lg font-bold leading-none">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}
