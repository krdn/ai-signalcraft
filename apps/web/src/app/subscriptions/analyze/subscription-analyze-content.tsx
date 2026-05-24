'use client';

import { HelpCircle, ChevronDown } from 'lucide-react';
import { AnalyzeWizard } from '@/components/subscriptions/analyze/analyze-wizard';
import { SubscriptionSelectStep } from '@/components/subscriptions/analyze/subscription-select-step';
import { AnalysisConfigStep } from '@/components/subscriptions/analyze/analysis-config-step';
import { AnalysisRunningStep } from '@/components/subscriptions/analyze/analysis-running-step';
import { AnalysisResultStep } from '@/components/subscriptions/analyze/analysis-result-step';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function SubscriptionAnalyzeContent() {
  return (
    <div className="container mx-auto max-w-4xl py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">구독 분석 실행</h1>
        <p className="text-muted-foreground">활성 구독에서 수집된 데이터로 AI 분석을 실행합니다</p>
        <Collapsible className="mt-3">
          <CollapsibleTrigger className="group inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer">
            <HelpCircle className="h-3.5 w-3.5" />
            사용 가이드
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 rounded-lg border bg-card p-4 text-sm space-y-3">
              <div>
                <p className="font-semibold text-foreground mb-1.5">구독 분석이란?</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  구독은 키워드와 데이터 소스를 등록해 두면{' '}
                  <span className="text-foreground">자동으로 데이터를 누적 수집</span>해 주는
                  단위입니다. 이 화면에서는 누적된 데이터를 대상으로 AI 분석만 실행합니다 — 새
                  데이터를 즉시 수집하지는 않으니, 최신 여론을 반영하려면 구독 모니터에서 수동
                  트리거를 먼저 실행하세요. 키워드 단발 분석이 필요하면{' '}
                  <span className="text-foreground">분석 실행</span> 메뉴를 사용하세요.
                </p>
              </div>
              <Separator />
              <div>
                <p className="font-semibold text-foreground mb-1.5">4단계 진행</p>
                <ol className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex gap-2">
                    <Badge
                      variant="outline"
                      className="shrink-0 h-4 w-4 justify-center p-0 text-[10px]"
                    >
                      1
                    </Badge>
                    <span>
                      <span className="text-foreground">구독 선택</span> — 분석 대상 구독을
                      고릅니다.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <Badge
                      variant="outline"
                      className="shrink-0 h-4 w-4 justify-center p-0 text-[10px]"
                    >
                      2
                    </Badge>
                    <span>
                      <span className="text-foreground">분석 설정</span> — 기간·도메인·토큰 최적화를
                      설정합니다. 각 항목 옆 <span className="text-foreground">ⓘ</span> 아이콘에
                      마우스를 올리면 상세 안내가 표시됩니다.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <Badge
                      variant="outline"
                      className="shrink-0 h-4 w-4 justify-center p-0 text-[10px]"
                    >
                      3
                    </Badge>
                    <span>
                      <span className="text-foreground">실행 중</span> — 5~15분 정도 소요됩니다.
                      분석 도중에 다른 페이지로 이동해도 진행은 계속됩니다.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <Badge
                      variant="outline"
                      className="shrink-0 h-4 w-4 justify-center p-0 text-[10px]"
                    >
                      4
                    </Badge>
                    <span>
                      <span className="text-foreground">결과</span> — AI 리포트를 확인하고 PDF로
                      내보낼 수 있습니다.
                    </span>
                  </li>
                </ol>
              </div>
              <div className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
                <span className="text-foreground font-medium">처음 사용하시나요?</span> 기본값(최근
                7일 · RAG 표준)으로 그대로 실행하면 가장 균형 잡힌 결과를 얻을 수 있습니다.
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
      <AnalyzeWizard>
        {(state, setState) => {
          switch (state.step) {
            case 'select':
              return (
                <SubscriptionSelectStep
                  onSelect={(sub) =>
                    setState({
                      step: 'config',
                      subscription: sub,
                      keyword: sub.keyword,
                    })
                  }
                />
              );
            case 'config':
              return state.subscription ? (
                <AnalysisConfigStep
                  subscription={state.subscription}
                  onTrigger={(jobId) => setState({ step: 'running', jobId })}
                  onBack={() => setState({ step: 'select' })}
                />
              ) : null;
            case 'running':
              return state.jobId ? (
                <AnalysisRunningStep
                  jobId={state.jobId}
                  keyword={state.keyword}
                  onComplete={() => setState({ step: 'result' })}
                />
              ) : null;
            case 'result':
              return state.jobId ? (
                <AnalysisResultStep
                  jobId={state.jobId}
                  onNewAnalysis={() =>
                    setState({
                      step: 'select',
                      subscription: null,
                      jobId: null,
                      keyword: '',
                    })
                  }
                />
              ) : null;
          }
        }}
      </AnalyzeWizard>
    </div>
  );
}
