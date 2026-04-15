'use client';

import { BrainCircuit, BookOpen, Settings } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { ModelOverviewTab } from './model-overview-tab';
import { ProblemDiagnosisTab } from './problem-diagnosis-tab';
import { UpgradeSuggestionsTab } from './upgrade-suggestions-tab';
import { TokenCostTab } from './token-cost-tab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpcClient } from '@/lib/trpc';
import { SettingsDialog } from '@/components/settings/settings-dialog';

interface LlmInsightsViewProps {
  jobId: number | null;
}

export function LlmInsightsView({ jobId }: LlmInsightsViewProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  const modelsQuery = useQuery({
    queryKey: ['llmInsights', 'moduleModels', jobId],
    queryFn: () => trpcClient.llmInsights.getModuleModels.query({ jobId: jobId! }),
    enabled: jobId !== null,
  });

  const costsQuery = useQuery({
    queryKey: ['llmInsights', 'tokenCosts', jobId],
    queryFn: () => trpcClient.llmInsights.getTokenCosts.query({ jobId: jobId! }),
    enabled: jobId !== null,
  });

  if (!jobId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <BrainCircuit className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">분석을 먼저 선택하세요</p>
        <p className="text-xs text-muted-foreground">
          사이드바에서 분석 작업을 선택하면 LLM 정보를 확인할 수 있습니다.
        </p>
      </div>
    );
  }

  const isLoading = modelsQuery.isPending || costsQuery.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BrainCircuit className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">LLM 인사이트</h2>
        <span className="text-sm text-muted-foreground">— Job #{jobId}</span>
        <a
          href="/docs/llm-model-recommendations.html"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <BookOpen className="h-3.5 w-3.5" />
          모델 가이드
        </a>
        {isAdmin && (
          <SettingsDialog
            triggerClassName="ml-1"
            triggerContent={
              <button className="flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <Settings className="h-3.5 w-3.5" />
                AI 설정
              </button>
            }
          />
        )}
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <p className="text-sm text-muted-foreground">불러오는 중…</p>
        </div>
      ) : (
        <Tabs defaultValue="overview">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="overview">🤖 모델 현황</TabsTrigger>
            <TabsTrigger value="problems">⚠️ 문제점 진단</TabsTrigger>
            <TabsTrigger value="upgrades">⬆️ 업그레이드 추천</TabsTrigger>
            <TabsTrigger value="costs">💰 토큰 비용</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <ModelOverviewTab modules={modelsQuery.data ?? []} />
          </TabsContent>

          <TabsContent value="problems" className="mt-4">
            <ProblemDiagnosisTab modules={modelsQuery.data ?? []} />
          </TabsContent>

          <TabsContent value="upgrades" className="mt-4">
            <UpgradeSuggestionsTab modules={modelsQuery.data ?? []} />
          </TabsContent>

          <TabsContent value="costs" className="mt-4">
            {costsQuery.data ? (
              <TokenCostTab items={costsQuery.data.items} total={costsQuery.data.total} />
            ) : (
              <p className="text-sm text-muted-foreground">비용 데이터가 없습니다.</p>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
