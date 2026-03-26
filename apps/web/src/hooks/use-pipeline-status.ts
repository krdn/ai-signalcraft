'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// SSE 기반 파이프라인 상태 실시간 훅
// 1초 간격 DB 폴링 → 변경 시에만 서버가 push
export function usePipelineStatus(jobId: number | null) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const jobIdRef = useRef(jobId);

  // jobId 변경 추적
  jobIdRef.current = jobId;

  const cleanup = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!jobId) {
      setData(null);
      setIsLoading(false);
      cleanup();
      return;
    }

    setIsLoading(true);
    cleanup();

    const es = new EventSource(`/api/pipeline/${jobId}/stream`);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);

        // NOT_FOUND 에러 처리
        if (parsed.error === 'NOT_FOUND') {
          setData(null);
          setIsLoading(false);
          es.close();
          return;
        }

        setData(parsed);
        setIsLoading(false);

        // 완료 상태 + 리포트 생성 완료 시 SSE 종료
        // (서버 측에서도 종료하지만 클라이언트에서도 정리)
        const isDone = parsed.status === 'failed' || parsed.status === 'cancelled' ||
          (parsed.hasReport && !parsed.analysisModulesDetailed?.some(
            (m: { status: string }) => m.status === 'running' || m.status === 'pending',
          ));
        if (isDone) {
          // 최종 데이터 수신 후 잠시 대기 후 종료
          setTimeout(() => {
            if (jobIdRef.current === jobId) {
              es.close();
            }
          }, 2000);
        }
      } catch {
        // JSON 파싱 실패 무시
      }
    };

    es.onerror = () => {
      // 연결 실패 시 자동 재연결 시도 (EventSource 기본 동작)
      // 3회 이상 연속 실패 시 종료
      setIsLoading(false);
    };

    return cleanup;
  }, [jobId, cleanup]);

  return { data, isLoading };
}
