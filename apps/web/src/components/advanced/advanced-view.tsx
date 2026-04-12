'use client';

import { buildFrameWarGraph, buildRiskChainGraph } from '@ai-signalcraft/core/client';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Brain } from 'lucide-react';
import { AdvancedHelp, AdvancedCardHelp, ADVANCED_HELP } from './advanced-help';
import { ApprovalRatingCard } from './approval-rating-card';
import { CrisisScenarios } from './crisis-scenarios';
import { CrisisTypeClassifierCard } from './crisis-type-classifier-card';
import { CsrCommunicationGapCard } from './csr-communication-gap-card';
import { FanLoyaltyCard } from './fan-loyalty-card';
import { FandomCrisisCard } from './fandom-crisis-card';
import { FrameWarChart } from './frame-war-chart';
import { FrameWarGraph } from './frame-war-graph';
import { MediaFramingDominanceCard } from './media-framing-dominance-card';
import { NarrativeWarChart } from './narrative-war-chart';
import { ReleasePredictionCard } from './release-prediction-card';
import { ReputationIndexCard } from './reputation-index-card';
import { ReputationRecoverySimulationCard } from './reputation-recovery-simulation-card';
import { WinSimulationCard } from './win-simulation-card';
import { MarketSentimentIndexCard } from './market-sentiment-index-card';
import { InformationAsymmetryCard } from './information-asymmetry-card';
import { CatalystScenarioCard } from './catalyst-scenario-card';
import { InvestmentSignalCard } from './investment-signal-card';
import { HealthRiskPerceptionCard } from './health-risk-perception-card';
import { CompliancePredictorCard } from './compliance-predictor-card';
import { OpportunityCard } from './opportunity-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpcClient } from '@/lib/trpc';

interface AdvancedViewProps {
  jobId: number | null;
  /** DB의 collectionJobs.domain 값 — 없으면 DB 조회 후 모듈명으로 역추론 */
  domain?: string;
  /** 공개 페이지에서 사용할 대체 데이터 페칭 함수 */
  fetchFn?: (jobId: number) => Promise<Array<{ module: string; status: string; result?: unknown }>>;
}

// 도메인별 ADVN 모듈 이름
const POLITICAL_ADVN_MODULES = [
  'approval-rating',
  'frame-war',
  'crisis-scenario',
  'win-simulation',
];
const FANDOM_ADVN_MODULES = [
  'fan-loyalty-index',
  'fandom-narrative-war',
  'fandom-crisis-scenario',
  'release-reception-prediction',
];
const CORPORATE_ADVN_MODULES = [
  'stakeholder-map',
  'esg-sentiment',
  'reputation-index',
  'crisis-type-classifier',
  'media-framing-dominance',
  'csr-communication-gap',
  'crisis-scenario',
  'reputation-recovery-simulation',
];
const PR_ADVN_MODULES = [
  'crisis-type-classifier',
  'reputation-index',
  'crisis-scenario',
  'frame-war',
];
const FINANCE_ADVN_MODULES = [
  'market-sentiment-index',
  'information-asymmetry',
  'catalyst-scenario',
  'investment-signal',
];
const HEALTHCARE_ADVN_MODULES = [
  'health-risk-perception',
  'compliance-predictor',
  'crisis-scenario',
  'opportunity',
];
const LEGAL_ADVN_MODULES = ['reputation-index', 'frame-war', 'crisis-scenario', 'win-simulation'];
const EDUCATION_ADVN_MODULES = [
  'approval-rating',
  'frame-war',
  'crisis-scenario',
  'win-simulation',
];
const ALL_ADVN_MODULES = [
  ...POLITICAL_ADVN_MODULES,
  ...FANDOM_ADVN_MODULES,
  ...CORPORATE_ADVN_MODULES,
  ...PR_ADVN_MODULES,
  ...FINANCE_ADVN_MODULES,
  ...HEALTHCARE_ADVN_MODULES,
  ...LEGAL_ADVN_MODULES,
  ...EDUCATION_ADVN_MODULES,
];

// 모듈별 결과를 파싱하는 유틸
function parseModuleResult(
  results: Array<{ module: string; result: unknown }>,
  moduleName: string,
) {
  const found = results.find((r) => r.module === moduleName);
  return found?.result as Record<string, unknown> | undefined;
}

// 모듈 이름으로 도메인 감지
function detectDomain(
  moduleResults: Array<{ module: string }>,
): 'political' | 'fandom' | 'corporate' | 'pr' | 'finance' | 'healthcare' | 'legal' | 'education' {
  const modules = moduleResults.map((r) => r.module);
  if (modules.some((m) => FINANCE_ADVN_MODULES.includes(m))) return 'finance';
  if (modules.some((m) => HEALTHCARE_ADVN_MODULES.includes(m))) return 'healthcare';
  if (modules.some((m) => FANDOM_ADVN_MODULES.includes(m))) return 'fandom';
  // Legal 판별: reputation-index + frame-war + win-simulation (PR과 구분 — PR은 win-simulation 없음)
  if (
    modules.includes('reputation-index') &&
    modules.includes('frame-war') &&
    modules.includes('win-simulation') &&
    !modules.includes('stakeholder-map')
  )
    return 'legal';
  // PR 판별: crisis-type-classifier + frame-war 조합 (corporate와 구분)
  if (
    modules.includes('crisis-type-classifier') &&
    modules.includes('frame-war') &&
    !modules.includes('stakeholder-map')
  )
    return 'pr';
  if (modules.some((m) => CORPORATE_ADVN_MODULES.includes(m))) return 'corporate';
  return 'political';
}

export function AdvancedView({ jobId, domain: domainProp, fetchFn }: AdvancedViewProps) {
  const defaultFetch = (id: number) => trpcClient.analysis.getResults.query({ jobId: id });
  const queryFnToUse = fetchFn ?? defaultFetch;

  const {
    data: results,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: fetchFn ? ['showcase', 'getResults', jobId] : ['analysis', 'getResults', jobId],
    queryFn: () => queryFnToUse(jobId!),
    enabled: !!jobId,
    staleTime: fetchFn ? Infinity : undefined,
  });

  // domain prop이 없을 때 DB에서 직접 조회 (로그인 사용자 대시보드)
  const needsDomainQuery = !!jobId && !domainProp && !fetchFn;
  const { data: jobDomain, isLoading: isDomainLoading } = useQuery({
    queryKey: ['analysis', 'getJobDomain', jobId],
    queryFn: () => trpcClient.analysis.getJobDomain.query({ jobId: jobId! }),
    enabled: needsDomainQuery,
    staleTime: Infinity,
  });

  // jobId 없음 -- 빈 상태
  if (!jobId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Brain className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-semibold">분석 결과를 선택하세요</p>
        <p className="text-sm mt-2">
          분석 실행 탭에서 새 분석을 시작하거나, 히스토리에서 이전 결과를 선택하세요.
        </p>
      </div>
    );
  }

  // 로딩 상태 -- Skeleton 카드
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="min-h-[320px]">
            <CardContent className="p-6">
              <Skeleton className="h-6 w-40 mb-4" />
              <Skeleton className="h-[260px] w-full rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // 에러 상태
  if (isError) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-muted-foreground">결과를 불러오는 중 오류가 발생했습니다.</p>
          <Button variant="outline" onClick={() => refetch()}>
            다시 시도
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 결과 파싱
  const moduleResults = (results ?? []) as Array<{ module: string; result: unknown }>;

  // ADVN 결과가 있는지 확인
  const hasAdvnResults = moduleResults.some((r) => ALL_ADVN_MODULES.includes(r.module));

  if (!hasAdvnResults) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Brain className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-semibold">이 분석에는 고급 분석 결과가 없습니다</p>
        <p className="text-sm mt-2">
          고급 분석은 최신 분석에서만 실행됩니다. 새 분석을 실행해 주세요.
        </p>
      </div>
    );
  }

  // domain prop이 없고 DB 조회 중이면 대기
  if (needsDomainQuery && isDomainLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="min-h-[320px]">
            <CardContent className="p-6">
              <Skeleton className="h-6 w-40 mb-4" />
              <Skeleton className="h-[260px] w-full rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // domain 결정: prop > DB 조회 > 모듈명 역추론
  const domain = (domainProp ?? jobDomain ?? detectDomain(moduleResults)) as ReturnType<
    typeof detectDomain
  >;

  return (
    <div className="space-y-4">
      {/* 상단 가이드 버튼 */}
      <div className="flex justify-end">
        <AdvancedHelp />
      </div>

      {/* 도메인별 카드 그리드 */}
      {domain === 'finance' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MarketSentimentIndexCard
            data={parseModuleResult(moduleResults, 'market-sentiment-index') ?? null}
          />
          <InformationAsymmetryCard
            data={parseModuleResult(moduleResults, 'information-asymmetry') ?? null}
          />
          <CatalystScenarioCard
            data={parseModuleResult(moduleResults, 'catalyst-scenario') ?? null}
          />
          <InvestmentSignalCard
            data={parseModuleResult(moduleResults, 'investment-signal') ?? null}
          />

          {/* 리스크 연쇄 그래프 */}
          {(() => {
            const riskData = parseModuleResult(moduleResults, 'risk-map');
            if (!riskData) return null;
            try {
              const graphData = buildRiskChainGraph(riskData as any);
              if (graphData.nodes.length === 0) return null;
              return (
                <Card className="min-h-[320px]">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-1.5">
                      리스크 연쇄 다이어그램
                      <AdvancedCardHelp {...ADVANCED_HELP.riskChainGraph} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FrameWarGraph data={graphData} width={600} height={400} />
                  </CardContent>
                </Card>
              );
            } catch {
              return null;
            }
          })()}
        </div>
      ) : domain === 'legal' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ReputationIndexCard
            data={parseModuleResult(moduleResults, 'reputation-index') ?? null}
          />
          <FrameWarChart data={parseModuleResult(moduleResults, 'frame-war') ?? null} />
          <CrisisScenarios data={parseModuleResult(moduleResults, 'crisis-scenario') ?? null} />
          <WinSimulationCard data={parseModuleResult(moduleResults, 'win-simulation') ?? null} />

          {/* 프레임 전쟁 네트워크 그래프 */}
          {(() => {
            const frameWarData = parseModuleResult(moduleResults, 'frame-war');
            const sentimentData = parseModuleResult(moduleResults, 'sentiment-framing');
            if (!frameWarData || !sentimentData) return null;
            try {
              const graphData = buildFrameWarGraph(frameWarData as any, sentimentData as any);
              if (graphData.nodes.length === 0) return null;
              return (
                <Card className="min-h-[320px]">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-1.5">
                      프레임 전쟁 네트워크
                      <AdvancedCardHelp {...ADVANCED_HELP.frameWarGraph} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FrameWarGraph data={graphData} width={600} height={400} />
                  </CardContent>
                </Card>
              );
            } catch {
              return null;
            }
          })()}

          {/* 리스크 연쇄 그래프 */}
          {(() => {
            const riskData = parseModuleResult(moduleResults, 'risk-map');
            if (!riskData) return null;
            try {
              const graphData = buildRiskChainGraph(riskData as any);
              if (graphData.nodes.length === 0) return null;
              return (
                <Card className="min-h-[320px]">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-1.5">
                      리스크 연쇄 다이어그램
                      <AdvancedCardHelp {...ADVANCED_HELP.riskChainGraph} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FrameWarGraph data={graphData} width={600} height={400} />
                  </CardContent>
                </Card>
              );
            } catch {
              return null;
            }
          })()}
        </div>
      ) : domain === 'pr' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CrisisTypeClassifierCard
            data={parseModuleResult(moduleResults, 'crisis-type-classifier') ?? null}
          />
          <ReputationIndexCard
            data={parseModuleResult(moduleResults, 'reputation-index') ?? null}
          />
          <FrameWarChart data={parseModuleResult(moduleResults, 'frame-war') ?? null} />
          <CrisisScenarios data={parseModuleResult(moduleResults, 'crisis-scenario') ?? null} />

          {/* 프레임 전쟁 네트워크 그래프 */}
          {(() => {
            const frameWarData = parseModuleResult(moduleResults, 'frame-war');
            const sentimentData = parseModuleResult(moduleResults, 'sentiment-framing');
            if (!frameWarData || !sentimentData) return null;
            try {
              const graphData = buildFrameWarGraph(frameWarData as any, sentimentData as any);
              if (graphData.nodes.length === 0) return null;
              return (
                <Card className="min-h-[320px]">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-1.5">
                      프레임 전쟁 네트워크
                      <AdvancedCardHelp {...ADVANCED_HELP.frameWarGraph} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FrameWarGraph data={graphData} width={600} height={400} />
                  </CardContent>
                </Card>
              );
            } catch {
              return null;
            }
          })()}

          {/* 리스크 연쇄 그래프 */}
          {(() => {
            const riskData = parseModuleResult(moduleResults, 'risk-map');
            if (!riskData) return null;
            try {
              const graphData = buildRiskChainGraph(riskData as any);
              if (graphData.nodes.length === 0) return null;
              return (
                <Card className="min-h-[320px]">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-1.5">
                      리스크 연쇄 다이어그램
                      <AdvancedCardHelp {...ADVANCED_HELP.riskChainGraph} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FrameWarGraph data={graphData} width={600} height={400} />
                  </CardContent>
                </Card>
              );
            } catch {
              return null;
            }
          })()}
        </div>
      ) : domain === 'healthcare' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <HealthRiskPerceptionCard
            data={parseModuleResult(moduleResults, 'health-risk-perception') ?? null}
          />
          <CompliancePredictorCard
            data={parseModuleResult(moduleResults, 'compliance-predictor') ?? null}
          />
          <CrisisScenarios data={parseModuleResult(moduleResults, 'crisis-scenario') ?? null} />
          <OpportunityCard data={parseModuleResult(moduleResults, 'opportunity') ?? null} />
        </div>
      ) : domain === 'fandom' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FanLoyaltyCard data={parseModuleResult(moduleResults, 'fan-loyalty-index') ?? null} />
          <NarrativeWarChart
            data={parseModuleResult(moduleResults, 'fandom-narrative-war') ?? null}
          />
          <FandomCrisisCard
            data={parseModuleResult(moduleResults, 'fandom-crisis-scenario') ?? null}
          />
          <ReleasePredictionCard
            data={parseModuleResult(moduleResults, 'release-reception-prediction') ?? null}
          />
        </div>
      ) : domain === 'corporate' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ReputationIndexCard
            data={parseModuleResult(moduleResults, 'reputation-index') ?? null}
          />
          <CrisisTypeClassifierCard
            data={parseModuleResult(moduleResults, 'crisis-type-classifier') ?? null}
          />
          <MediaFramingDominanceCard
            data={parseModuleResult(moduleResults, 'media-framing-dominance') ?? null}
          />
          <CsrCommunicationGapCard
            data={parseModuleResult(moduleResults, 'csr-communication-gap') ?? null}
          />
          <CrisisScenarios data={parseModuleResult(moduleResults, 'crisis-scenario') ?? null} />
          <ReputationRecoverySimulationCard
            data={parseModuleResult(moduleResults, 'reputation-recovery-simulation') ?? null}
          />

          {/* 리스크 연쇄 그래프 */}
          {(() => {
            const riskData = parseModuleResult(moduleResults, 'risk-map');
            if (!riskData) return null;
            try {
              const graphData = buildRiskChainGraph(riskData as any);
              if (graphData.nodes.length === 0) return null;
              return (
                <Card className="min-h-[320px]">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-1.5">
                      리스크 연쇄 다이어그램
                      <AdvancedCardHelp {...ADVANCED_HELP.riskChainGraph} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FrameWarGraph data={graphData} width={600} height={400} />
                  </CardContent>
                </Card>
              );
            } catch {
              return null;
            }
          })()}
        </div>
      ) : domain === 'education' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ApprovalRatingCard data={parseModuleResult(moduleResults, 'approval-rating') ?? null} />
          <FrameWarChart data={parseModuleResult(moduleResults, 'frame-war') ?? null} />
          <CrisisScenarios data={parseModuleResult(moduleResults, 'crisis-scenario') ?? null} />
          <WinSimulationCard data={parseModuleResult(moduleResults, 'win-simulation') ?? null} />

          {/* 프레임 전쟁 네트워크 그래프 */}
          {(() => {
            const frameWarData = parseModuleResult(moduleResults, 'frame-war');
            const sentimentData = parseModuleResult(moduleResults, 'sentiment-framing');
            if (!frameWarData || !sentimentData) return null;
            try {
              const graphData = buildFrameWarGraph(frameWarData as any, sentimentData as any);
              if (graphData.nodes.length === 0) return null;
              return (
                <Card className="min-h-[320px]">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-1.5">
                      프레임 전쟁 네트워크
                      <AdvancedCardHelp {...ADVANCED_HELP.frameWarGraph} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FrameWarGraph data={graphData} width={600} height={400} />
                  </CardContent>
                </Card>
              );
            } catch {
              return null;
            }
          })()}

          {/* 리스크 연쇄 그래프 */}
          {(() => {
            const riskData = parseModuleResult(moduleResults, 'risk-map');
            if (!riskData) return null;
            try {
              const graphData = buildRiskChainGraph(riskData as any);
              if (graphData.nodes.length === 0) return null;
              return (
                <Card className="min-h-[320px]">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-1.5">
                      리스크 연쇄 다이어그램
                      <AdvancedCardHelp {...ADVANCED_HELP.riskChainGraph} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FrameWarGraph data={graphData} width={600} height={400} />
                  </CardContent>
                </Card>
              );
            } catch {
              return null;
            }
          })()}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ApprovalRatingCard data={parseModuleResult(moduleResults, 'approval-rating') ?? null} />
          <FrameWarChart data={parseModuleResult(moduleResults, 'frame-war') ?? null} />
          <CrisisScenarios data={parseModuleResult(moduleResults, 'crisis-scenario') ?? null} />
          <WinSimulationCard data={parseModuleResult(moduleResults, 'win-simulation') ?? null} />

          {/* 프레임 전쟁 네트워크 그래프 */}
          {(() => {
            const frameWarData = parseModuleResult(moduleResults, 'frame-war');
            const sentimentData = parseModuleResult(moduleResults, 'sentiment-framing');
            if (!frameWarData || !sentimentData) return null;
            try {
              const graphData = buildFrameWarGraph(frameWarData as any, sentimentData as any);
              if (graphData.nodes.length === 0) return null;
              return (
                <Card className="min-h-[320px]">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-1.5">
                      프레임 전쟁 네트워크
                      <AdvancedCardHelp {...ADVANCED_HELP.frameWarGraph} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FrameWarGraph data={graphData} width={600} height={400} />
                  </CardContent>
                </Card>
              );
            } catch {
              return null;
            }
          })()}

          {/* 리스크 연쇄 그래프 */}
          {(() => {
            const riskData = parseModuleResult(moduleResults, 'risk-map');
            if (!riskData) return null;
            try {
              const graphData = buildRiskChainGraph(riskData as any);
              if (graphData.nodes.length === 0) return null;
              return (
                <Card className="min-h-[320px]">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-1.5">
                      리스크 연쇄 다이어그램
                      <AdvancedCardHelp {...ADVANCED_HELP.riskChainGraph} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FrameWarGraph data={graphData} width={600} height={400} />
                  </CardContent>
                </Card>
              );
            } catch {
              return null;
            }
          })()}
        </div>
      )}
    </div>
  );
}
