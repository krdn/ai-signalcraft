'use client';

import { PipelineMonitor } from '@/components/analysis/pipeline-monitor';

interface AnalysisRunningStepProps {
  /** 분석 잡 ID */
  jobId: number;
  /** 분석 키워드 (표시용 — PipelineMonitor가 SSE에서 자체 조회) */
  keyword: string;
  /** 분석 완료 시 호출 */
  onComplete: () => void;
  /** 오류 발생 시 재시도 콜백 */
  onRetry?: () => void;
  /** 읽기 전용 모드 (제어 버튼 숨김) */
  readOnly?: boolean;
}

/**
 * 구독 분석 마법사 Step 3 — 분석 실행 중 모니터링
 *
 * PipelineMonitor를 래핑하여 구독 마법사 컨텍스트에 맞는 props를 제공합니다.
 * - readOnly 모드 지원 (진행 상태만 관찰)
 * - 완료 자동 감지 → onComplete 호출
 */
export function AnalysisRunningStep({
  jobId,
  keyword: _keyword,
  onComplete,
  onRetry,
  readOnly,
}: AnalysisRunningStepProps) {
  return (
    <PipelineMonitor jobId={jobId} onComplete={onComplete} onRetry={onRetry} readOnly={readOnly} />
  );
}
