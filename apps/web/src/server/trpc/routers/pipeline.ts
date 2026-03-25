import { z } from 'zod';
import { protectedProcedure, router } from '../init';
import { collectionJobs, analysisResults, analysisReports } from '@ai-signalcraft/core';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

// 분석 모듈 한글 라벨 매핑
const MODULE_LABELS: Record<string, string> = {
  'sentiment-framing': '감정 프레이밍',
  'macro-view': '거시 분석',
  'segmentation': '세그멘테이션',
  'message-impact': '메시지 임팩트',
  'risk-map': '리스크 맵',
  'opportunity': '기회 발굴',
  'strategy': '전략 제안',
  'final-summary': '종합 요약',
  'approval-rating': '지지율 분석',
  'frame-war': '프레임 전쟁',
  'crisis-scenario': '위기 시나리오',
  'win-simulation': '승리 시뮬레이션',
};

// 소스별 한글 라벨 매핑
const SOURCE_LABELS: Record<string, string> = {
  'naver-news': '네이버 뉴스',
  'youtube-videos': '유튜브',
  'youtube-comments': '유튜브 댓글',
  'dcinside': 'DC갤러리',
  'fmkorea': '에펨코리아',
  'clien': '클리앙',
  // progress JSONB 키가 다른 형태일 수 있으므로 추가 매핑
  'naver': '네이버 뉴스',
  'youtube': '유튜브',
};

export type SourceDetailStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface SourceDetail {
  status: SourceDetailStatus;
  count: number;
  label: string;
}

export const pipelineRouter = router({
  // 파이프라인 상태 조회 -- 4단계 진행 상태를 collectionJobs/analysisResults/analysisReports에서 파생
  getStatus: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input, ctx }) => {
      // 1. collectionJobs에서 수집 상태 조회 (팀 소속 확인)
      const jobConditions = ctx.teamId
        ? and(eq(collectionJobs.id, input.jobId), eq(collectionJobs.teamId, ctx.teamId))
        : eq(collectionJobs.id, input.jobId);
      const [job] = await ctx.db.select()
        .from(collectionJobs)
        .where(jobConditions);
      if (!job) throw new TRPCError({ code: 'NOT_FOUND' });

      // 2. analysisResults에서 분석 모듈 상태 조회
      const analysisRows = await ctx.db.select()
        .from(analysisResults)
        .where(eq(analysisResults.jobId, input.jobId));

      // 3. analysisReports에서 리포트 존재 여부 조회
      const [report] = await ctx.db.select({ id: analysisReports.id })
        .from(analysisReports)
        .where(eq(analysisReports.jobId, input.jobId))
        .limit(1);

      // 4단계 파이프라인 상태 파생 (per D-12):
      //   수집(collection) -> 정규화(normalization) -> 분석(analysis) -> 리포트(report)
      const collectionDone = job.status === 'completed' || job.status === 'partial_failure';
      const collectionFailed = job.status === 'failed';
      const normalizationDone = collectionDone; // BullMQ Flow에서 수집 후 자동 정규화
      const analysisStarted = analysisRows.length > 0;
      const analysisInProgress = analysisRows.some(r => r.status === 'running' || r.status === 'pending');
      const analysisDone = analysisStarted && !analysisInProgress;
      const reportDone = !!report;

      const pipelineStages = {
        collection: {
          status: collectionFailed ? 'failed' as const
            : collectionDone ? 'completed' as const
            : job.status === 'running' ? 'running' as const
            : 'pending' as const,
        },
        normalization: {
          status: collectionFailed ? 'skipped' as const
            : normalizationDone ? 'completed' as const
            : 'pending' as const,
        },
        analysis: {
          status: collectionFailed ? 'skipped' as const
            : analysisDone ? 'completed' as const
            : analysisInProgress ? 'running' as const
            : analysisStarted ? 'running' as const
            : 'pending' as const,
        },
        report: {
          status: collectionFailed ? 'skipped' as const
            : reportDone ? 'completed' as const
            : analysisDone ? 'running' as const
            : 'pending' as const,
        },
      };

      // 소스별 수집 상세 — progress JSONB에서 추출
      const sourceDetails: Record<string, SourceDetail> = {};
      const progress = job.progress as Record<string, { status?: string; posts?: number; articles?: number; videos?: number; comments?: number }> | null;
      if (progress) {
        for (const [key, val] of Object.entries(progress)) {
          const label = SOURCE_LABELS[key] ?? key;
          const count = (val.articles ?? 0) + (val.videos ?? 0) + (val.posts ?? 0) + (val.comments ?? 0);
          sourceDetails[key] = {
            status: (val.status as SourceDetailStatus) ?? 'pending',
            count,
            label,
          };
        }
      }

      // errorDetails에서 소스별 실패 정보 반영
      const errorDetails = job.errorDetails as Record<string, string> | null;
      if (errorDetails) {
        for (const [key] of Object.entries(errorDetails)) {
          if (sourceDetails[key]) {
            sourceDetails[key].status = 'failed';
          } else {
            sourceDetails[key] = {
              status: 'failed',
              count: 0,
              label: SOURCE_LABELS[key] ?? key,
            };
          }
        }
      }

      // 분석 모듈별 상세 상태
      const analysisModules = analysisRows.map(row => ({
        module: row.module,
        status: row.status as 'pending' | 'running' | 'completed' | 'failed',
        label: MODULE_LABELS[row.module] ?? row.module,
      }));

      // 경과 시간(초) — createdAt 대비 현재 시간
      const elapsedSeconds = Math.floor((Date.now() - new Date(job.createdAt).getTime()) / 1000);

      return {
        status: job.status,
        progress: job.progress,
        errorDetails: job.errorDetails,
        keyword: job.keyword,
        pipelineStages,
        analysisModuleCount: {
          total: analysisRows.length,
          completed: analysisRows.filter(r => r.status === 'completed').length,
        },
        hasReport: reportDone,
        // 확장 필드
        sourceDetails,
        analysisModules,
        elapsedSeconds,
      };
    }),
});
