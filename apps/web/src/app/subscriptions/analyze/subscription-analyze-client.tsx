'use client';

import { AnalyzeWizard } from '@/components/subscriptions/analyze/analyze-wizard';
import { SubscriptionSelectStep } from '@/components/subscriptions/analyze/subscription-select-step';
import { AnalysisConfigStep } from '@/components/subscriptions/analyze/analysis-config-step';
import { AnalysisRunningStep } from '@/components/subscriptions/analyze/analysis-running-step';
import { AnalysisResultStep } from '@/components/subscriptions/analyze/analysis-result-step';

export default function SubscriptionAnalyzeClient() {
  return (
    <div className="container mx-auto max-w-4xl py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">구독 분석 실행</h1>
        <p className="text-muted-foreground">활성 구독에서 수집된 데이터로 AI 분석을 실행합니다</p>
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
