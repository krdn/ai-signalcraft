'use client';

import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Brain,
  ChevronRight,
  Globe,
  Lightbulb,
  ListChecks,
  Rocket,
  Sparkles,
} from 'lucide-react';
import type { UseCaseDetail } from './data/use-cases';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export function UseCaseDetailModal({
  detail,
  domainId,
  open,
  onOpenChange,
}: {
  detail: UseCaseDetail | null;
  domainId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!detail) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn('flex size-11 items-center justify-center rounded-xl bg-primary/10')}
            >
              <detail.icon className={cn('size-6', detail.color)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl">{detail.title}</DialogTitle>
                {domainId && (
                  <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                    {domainId}
                  </Badge>
                )}
              </div>
              <DialogDescription className="mt-0.5 text-sm italic">
                {detail.tagline}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Pain Points */}
        <div className="mt-2 rounded-lg border border-red-200/50 bg-red-50/50 p-4 dark:border-red-900/30 dark:bg-red-950/20">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400">
            <AlertTriangle className="size-4" />
            현재 이런 문제가 있지 않나요?
          </h4>
          <ul className="space-y-2">
            {detail.painPoints.map((p, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <p.icon className="mt-0.5 size-4 shrink-0 text-red-400" />
                <span>{p.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 활용 시나리오 */}
        <div className="mt-1">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Rocket className="size-4 text-primary" />
            AI SignalCraft 활용 시나리오
          </h4>
          <div className="space-y-3">
            {detail.scenarios.map((s, i) => (
              <div
                key={i}
                className="rounded-lg border bg-muted/30 p-4 transition-colors hover:bg-muted/50"
              >
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                    <s.icon className="size-4 text-primary" />
                  </div>
                  <h5 className="font-semibold">{s.title}</h5>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 추천 데이터 소스 */}
        <div className="mt-1">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Globe className="size-4 text-primary" />
            활용 가능한 데이터 소스
          </h4>
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="mb-3">
              <div className="mb-2 flex items-center gap-2">
                <Badge className="shrink-0 bg-primary text-[10px]">수집 중</Badge>
                <span className="text-xs text-muted-foreground">현재 바로 활용 가능</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {detail.recommendedSources.active.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="mb-3">
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  추가 예정
                </Badge>
                <span className="text-xs text-muted-foreground">곧 지원 예정</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {detail.recommendedSources.upcoming.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              <Lightbulb className="mr-1 inline size-3 text-amber-500" />
              {detail.recommendedSources.reason}
            </p>
          </div>
        </div>

        {/* 워크플로우 */}
        <div className="mt-1">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ListChecks className="size-4 text-primary" />
            분석 워크플로우
          </h4>
          <div className="relative space-y-0">
            {detail.workflow.map((w, i) => (
              <div key={i} className="relative flex gap-3 pb-4 last:pb-0">
                {i < detail.workflow.length - 1 && (
                  <div className="absolute left-[15px] top-8 h-[calc(100%-16px)] w-px bg-border" />
                )}
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </div>
                <div className="pt-1">
                  <div className="text-sm font-medium">{w.step}</div>
                  <div className="text-xs text-muted-foreground">{w.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 핵심 분석 모듈 */}
        <div className="mt-1">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Brain className="size-4 text-primary" />
            핵심 활용 모듈
          </h4>
          <div className="flex flex-wrap gap-2">
            {detail.keyModules.map((m) => (
              <Badge key={m} variant="secondary" className="gap-1.5">
                <Sparkles className="size-3" />
                {m}
              </Badge>
            ))}
          </div>
        </div>

        {/* 임팩트 지표 */}
        <div className="mt-1">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ArrowUpRight className="size-4 text-primary" />
            도입 효과
          </h4>
          <div className="grid gap-3 sm:grid-cols-3">
            {detail.impactMetrics.map((m, i) => (
              <div key={i} className="rounded-lg border p-3 text-center">
                <m.icon className="mx-auto mb-2 size-5 text-primary" />
                <div className="mb-2 text-xs font-medium text-muted-foreground">{m.label}</div>
                <div className="flex items-center justify-center gap-1.5 text-xs">
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-600 line-through dark:bg-red-950 dark:text-red-400">
                    {m.before}
                  </span>
                  <ChevronRight className="size-3 text-muted-foreground" />
                  <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold text-green-600 dark:bg-green-950 dark:text-green-400">
                    {m.after}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 인사이트 문구 */}
        <div className="mt-2 rounded-lg border-l-4 border-primary bg-primary/5 p-4">
          <p className="text-sm italic leading-relaxed text-foreground/80">
            &ldquo;{detail.insightQuote}&rdquo;
          </p>
        </div>

        {/* CTA */}
        <div className="mt-2 flex justify-center">
          <a
            href="#pricing"
            className={cn(buttonVariants({ size: 'lg' }), 'gap-1.5')}
            onClick={() => onOpenChange(false)}
          >
            7일 무료 체험 시작
            <ArrowRight className="size-4" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
