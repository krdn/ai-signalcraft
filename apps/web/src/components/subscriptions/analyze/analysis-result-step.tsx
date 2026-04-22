'use client';

import { RefreshCw } from 'lucide-react';
import { ReportView } from '@/components/report/report-view';
import { Button } from '@/components/ui/button';

interface AnalysisResultStepProps {
  /** 분석 잡 ID */
  jobId: number;
  /** 새 분석 실행 버튼 클릭 시 호출 */
  onNewAnalysis: () => void;
}

/**
 * 구독 분석 마법사 Step 4 — 분석 결과 리포트
 *
 * ReportView를 래핑하여 구독 마법사 컨텍스트에 맞는 props를 제공합니다.
 * - jobId로 리포트 데이터를 자동 로드
 * - "새 분석 실행" 버튼으로 마법사 초기 단계로 복귀
 */
export function AnalysisResultStep({ jobId, onNewAnalysis }: AnalysisResultStepProps) {
  return (
    <div className="space-y-4">
      {/* 상단 액션 바 */}
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onNewAnalysis}>
          <RefreshCw className="h-3.5 w-3.5" />새 분석 실행
        </Button>
      </div>

      {/* 리포트 뷰어 */}
      <ReportView jobId={jobId} />
    </div>
  );
}
