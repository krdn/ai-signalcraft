'use client';

import { useEffect } from 'react';
import { usePipelineStatus } from '@/hooks/use-pipeline-status';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, Loader2, Clock } from 'lucide-react';

const STAGE_LABELS = [
  { key: 'collection', label: '수집' },
  { key: 'normalization', label: '정규화' },
  { key: 'analysis', label: '분석' },
  { key: 'report', label: '리포트' },
] as const;

type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

function StageIcon({ status }: { status: StageStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-accent" />;
    case 'failed':
    case 'skipped':
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

function stageToProgress(status: StageStatus): number {
  switch (status) {
    case 'completed': return 100;
    case 'running': return 50;
    case 'failed':
    case 'skipped': return 100;
    default: return 0;
  }
}

interface PipelineMonitorProps {
  jobId: number | null;
  onComplete?: () => void;
  onRetry?: () => void;
}

export function PipelineMonitor({ jobId, onComplete, onRetry }: PipelineMonitorProps) {
  const { data, isLoading } = usePipelineStatus(jobId);

  // 완료 시 toast + 탭 전환
  useEffect(() => {
    if (data?.status === 'completed' || data?.hasReport) {
      toast.success('분석이 완료되었습니다');
      onComplete?.();
    }
  }, [data?.status, data?.hasReport, onComplete]);

  if (!jobId) return null;

  if (isLoading) {
    return (
      <Card className="mx-auto max-w-xl mt-4">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const pipelineStages = data.pipelineStages;
  const hasFailed = data.status === 'failed';

  return (
    <Card className="mx-auto max-w-xl mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            파이프라인 진행 상태
          </CardTitle>
          <Badge
            variant={hasFailed ? 'destructive' : data.status === 'completed' ? 'default' : 'secondary'}
          >
            {data.keyword}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 4단계 프로그레스 */}
        <div className="space-y-3">
          {STAGE_LABELS.map(({ key, label }) => {
            const stage = pipelineStages[key];
            const status = stage.status as StageStatus;
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <StageIcon status={status} />
                    <span className="font-medium">{label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {status === 'completed' ? '완료' : status === 'running' ? '진행 중' : status === 'failed' ? '실패' : status === 'skipped' ? '건너뜀' : '대기'}
                  </span>
                </div>
                <Progress
                  value={stageToProgress(status)}
                  className="h-2"
                />
              </div>
            );
          })}
        </div>

        {/* 소스별 수집 건수 */}
        {data.progress && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono">
            {data.progress.naver && (
              <span>네이버: {data.progress.naver.articles ?? 0}건</span>
            )}
            {data.progress.youtube && (
              <span>유튜브: {data.progress.youtube.videos ?? 0}건</span>
            )}
          </div>
        )}

        {/* 분석 모듈 진행 */}
        {data.analysisModuleCount.total > 0 && (
          <div className="text-sm text-muted-foreground font-mono">
            분석 모듈: {data.analysisModuleCount.completed}/{data.analysisModuleCount.total} 완료
          </div>
        )}

        {/* 에러 상태 + 재시도 버튼 (D-13) */}
        {hasFailed && (
          <div className="flex items-center justify-between rounded-md bg-destructive/10 p-3">
            <p className="text-sm text-destructive">
              수집 중 오류가 발생했습니다. 일부 소스에서 데이터를 가져오지 못했습니다.
            </p>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                다시 시도
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
