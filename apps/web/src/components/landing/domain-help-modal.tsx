'use client';

import { BookOpen, Brain, FlaskConical, Lightbulb, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

export interface DomainTheory {
  theory: string;
  scholar: string;
  year: number;
  keyConceptKo: string;
  application: string;
}

export interface DomainHelpData {
  id: string;
  displayName: string;
  description: string;
  tagline?: string;
  /** 분석 단계 및 모듈 설명 */
  analysisModules: {
    stage: string;
    label: string;
    modules: { name: string; description: string }[];
  }[];
  /** 학술 이론 참조 */
  theoreticalBasis: DomainTheory[];
  /** 실제 활용 시나리오 */
  usageExamples: {
    scenario: string;
    context: string;
    outcome: string;
  }[];
}

export function DomainHelpModal({
  data,
  open,
  onOpenChange,
}: {
  data: DomainHelpData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Brain className="size-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl">{data.displayName}</DialogTitle>
                <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                  {data.id}
                </Badge>
              </div>
              {data.tagline && (
                <DialogDescription className="mt-0.5 text-sm italic">
                  {data.tagline}
                </DialogDescription>
              )}
              <p className="mt-1 text-sm text-muted-foreground">{data.description}</p>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1 gap-1.5 text-xs">
              <Lightbulb className="size-3.5" />
              개요
            </TabsTrigger>
            <TabsTrigger value="modules" className="flex-1 gap-1.5 text-xs">
              <FlaskConical className="size-3.5" />
              분석 모듈
            </TabsTrigger>
            <TabsTrigger value="theory" className="flex-1 gap-1.5 text-xs">
              <BookOpen className="size-3.5" />
              이론적 기반
            </TabsTrigger>
            <TabsTrigger value="examples" className="flex-1 gap-1.5 text-xs">
              <Users className="size-3.5" />
              활용 예시
            </TabsTrigger>
          </TabsList>

          {/* 개요 탭 */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <h4 className="mb-2 text-sm font-semibold">이 분석은 무엇을 제공하나요?</h4>
              <p className="text-sm text-muted-foreground">{data.description}</p>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold">주요 분석 단계</h4>
              <div className="space-y-2">
                {data.analysisModules.map((group) => (
                  <div key={group.stage} className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {group.stage}
                    </Badge>
                    <div>
                      <span className="text-sm font-medium">{group.label}</span>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {group.modules.map((m) => m.name).join(' · ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {data.theoreticalBasis.length > 0 && (
              <div className="rounded-lg border border-blue-200/50 bg-blue-50/50 p-3 dark:border-blue-900/30 dark:bg-blue-950/20">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <span className="font-semibold">이론적 기반:</span>{' '}
                  {data.theoreticalBasis.map((t) => t.keyConceptKo).join(', ')}
                </p>
              </div>
            )}
          </TabsContent>

          {/* 분석 모듈 탭 */}
          <TabsContent value="modules" className="mt-4 space-y-4">
            {data.analysisModules.map((group) => (
              <div key={group.stage}>
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {group.stage}
                  </Badge>
                  <span className="text-sm font-semibold">{group.label}</span>
                </div>
                <div className="space-y-2 pl-2">
                  {group.modules.map((module) => (
                    <div key={module.name} className="rounded-md border bg-card p-3">
                      <p className="text-sm font-medium">{module.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{module.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          {/* 이론적 기반 탭 */}
          <TabsContent value="theory" className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              이 분석 유형은 세계적으로 검증된 학술 이론을 기반으로 설계되었습니다.
            </p>
            {data.theoreticalBasis.map((theory, i) => (
              <div key={i} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{theory.keyConceptKo}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{theory.theory}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {theory.scholar.split(',')[0]}, {theory.year}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground border-t pt-2">
                  <span className="font-medium text-foreground">적용:</span> {theory.application}
                </p>
              </div>
            ))}
          </TabsContent>

          {/* 활용 예시 탭 */}
          <TabsContent value="examples" className="mt-4 space-y-4">
            {data.usageExamples.map((example, i) => (
              <div key={i} className="rounded-lg border p-4">
                <p className="text-sm font-semibold text-primary">{example.scenario}</p>
                <div className="mt-2 space-y-1.5">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">상황: </span>
                    <span className="text-xs">{example.context}</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">결과: </span>
                    <span className="text-xs">{example.outcome}</span>
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
