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
  'naver': '네이버 뉴스',
  'youtube': '유튜브',
};

// 모듈 → Stage 매핑
const MODULE_STAGE: Record<string, number> = {
  'macro-view': 1, 'segmentation': 1, 'sentiment-framing': 1, 'message-impact': 1,
  'risk-map': 2, 'opportunity': 2, 'strategy': 2,
  'final-summary': 3,
  'approval-rating': 4, 'frame-war': 4, 'crisis-scenario': 4, 'win-simulation': 4,
};

// AI 토큰 비용 상수 (USD per 1K tokens)
const TOKEN_COST_PER_1K: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
};

function estimateCost(inputTokens: number, outputTokens: number, model: string): number {
  const cost = TOKEN_COST_PER_1K[model];
  if (!cost) return 0;
  return (inputTokens / 1000) * cost.input + (outputTokens / 1000) * cost.output;
}

export type SourceDetailStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface SourceDetail {
  status: SourceDetailStatus;
  count: number;
  label: string;
}

export const pipelineRouter = router({
  // 파이프라인 상태 조회 -- 확장된 상세 정보 포함
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

      // 2. analysisResults에서 분석 모듈 상태 + usage + timestamps 조회
      const analysisRows = await ctx.db.select()
        .from(analysisResults)
        .where(eq(analysisResults.jobId, input.jobId));

      // 3. analysisReports에서 리포트 조회 (타임스탬프 포함)
      const [report] = await ctx.db.select({
        id: analysisReports.id,
        createdAt: analysisReports.createdAt,
      })
        .from(analysisReports)
        .where(eq(analysisReports.jobId, input.jobId))
        .limit(1);

      // --- 4단계 파이프라인 상태 파생 ---
      const collectionDone = job.status === 'completed' || job.status === 'partial_failure';
      const collectionFailed = job.status === 'failed';
      const normalizationDone = collectionDone;
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

      // --- 소스별 수집 상세 ---
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

      // --- 기본 분석 모듈 (하위 호환) ---
      const analysisModules = analysisRows.map(row => ({
        module: row.module,
        status: row.status as 'pending' | 'running' | 'completed' | 'failed',
        label: MODULE_LABELS[row.module] ?? row.module,
      }));

      // --- 확장: 분석 모듈 상세 (토큰, 소요시간, Stage) ---
      const analysisModulesDetailed = analysisRows.map(row => {
        const usage = row.usage as { inputTokens?: number; outputTokens?: number; provider?: string; model?: string } | null;
        const startedAt = row.createdAt ? new Date(row.createdAt).toISOString() : null;
        const completedAt = (row.status === 'completed' || row.status === 'failed') && row.updatedAt
          ? new Date(row.updatedAt).toISOString()
          : null;
        const durationSeconds = startedAt && completedAt
          ? Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000)
          : null;

        return {
          module: row.module,
          label: MODULE_LABELS[row.module] ?? row.module,
          status: row.status as 'pending' | 'running' | 'completed' | 'failed',
          stage: MODULE_STAGE[row.module] ?? 0,
          usage: usage ? {
            input: usage.inputTokens ?? 0,
            output: usage.outputTokens ?? 0,
            provider: usage.provider ?? '',
            model: usage.model ?? '',
          } : null,
          errorMessage: row.errorMessage ?? null,
          startedAt,
          completedAt,
          durationSeconds,
        };
      });

      // --- 확장: 토큰 사용량 집계 ---
      let totalInput = 0;
      let totalOutput = 0;
      let totalCost = 0;
      const byModule: Array<{ module: string; input: number; output: number; provider: string; model: string }> = [];

      for (const mod of analysisModulesDetailed) {
        if (mod.usage && mod.usage.input + mod.usage.output > 0) {
          totalInput += mod.usage.input;
          totalOutput += mod.usage.output;
          const cost = estimateCost(mod.usage.input, mod.usage.output, mod.usage.model);
          totalCost += cost;
          byModule.push({
            module: mod.module,
            input: mod.usage.input,
            output: mod.usage.output,
            provider: mod.usage.provider,
            model: mod.usage.model,
          });
        }
      }

      const tokenUsage = {
        total: { input: totalInput, output: totalOutput },
        byModule,
        estimatedCostUsd: Math.round(totalCost * 10000) / 10000, // 소수 4자리까지
      };

      // --- 확장: 타임라인 ---
      const analysisTimestamps = analysisRows
        .filter(r => r.createdAt)
        .map(r => new Date(r.createdAt!).getTime());
      const completedTimestamps = analysisRows
        .filter(r => (r.status === 'completed' || r.status === 'failed') && r.updatedAt)
        .map(r => new Date(r.updatedAt!).getTime());

      const timeline = {
        jobCreatedAt: new Date(job.createdAt).toISOString(),
        jobUpdatedAt: new Date(job.updatedAt).toISOString(),
        analysisStartedAt: analysisTimestamps.length > 0
          ? new Date(Math.min(...analysisTimestamps)).toISOString()
          : null,
        analysisCompletedAt: completedTimestamps.length > 0
          ? new Date(Math.max(...completedTimestamps)).toISOString()
          : null,
        reportCompletedAt: report?.createdAt
          ? new Date(report.createdAt).toISOString()
          : null,
      };

      // --- 확장: 이벤트 로그 합성 ---
      const events: Array<{ timestamp: string; level: 'info' | 'warn' | 'error'; message: string }> = [];

      // 파이프라인 시작
      events.push({
        timestamp: timeline.jobCreatedAt,
        level: 'info',
        message: `파이프라인 시작: "${job.keyword}" 분석`,
      });

      // 소스별 수집 이벤트
      if (progress) {
        for (const [key, val] of Object.entries(progress)) {
          const label = SOURCE_LABELS[key] ?? key;
          const count = (val.articles ?? 0) + (val.videos ?? 0) + (val.posts ?? 0) + (val.comments ?? 0);

          if (val.status === 'completed') {
            events.push({
              timestamp: timeline.jobUpdatedAt, // 정확한 완료 시점은 없으므로 job updatedAt 근사
              level: 'info',
              message: `${label} 수집 완료 (${count}건)`,
            });
          } else if (val.status === 'failed') {
            const errMsg = errorDetails?.[key] ?? '알 수 없는 오류';
            events.push({
              timestamp: timeline.jobUpdatedAt,
              level: 'error',
              message: `${label} 수집 실패: ${errMsg}`,
            });
          } else if (val.status === 'running') {
            events.push({
              timestamp: timeline.jobCreatedAt,
              level: 'info',
              message: `${label} 수집 중... (현재 ${count}건)`,
            });
          }
        }
      }

      // 수집 완료/실패 이벤트
      if (collectionDone) {
        const totalCount = Object.values(sourceDetails).reduce((sum, s) => sum + s.count, 0);
        events.push({
          timestamp: timeline.jobUpdatedAt,
          level: job.status === 'partial_failure' ? 'warn' : 'info',
          message: job.status === 'partial_failure'
            ? `수집 부분 완료 (총 ${totalCount}건, 일부 소스 실패)`
            : `수집 완료 (총 ${totalCount}건)`,
        });
      } else if (collectionFailed) {
        events.push({
          timestamp: timeline.jobUpdatedAt,
          level: 'error',
          message: '수집 실패 — 파이프라인 중단',
        });
      }

      // 분석 모듈별 이벤트
      for (const mod of analysisModulesDetailed) {
        const label = MODULE_LABELS[mod.module] ?? mod.module;
        if (mod.status === 'completed' && mod.completedAt) {
          const tokenInfo = mod.usage ? ` (${(mod.usage.input + mod.usage.output).toLocaleString()} 토큰)` : '';
          events.push({
            timestamp: mod.completedAt,
            level: 'info',
            message: `${label} 분석 완료${tokenInfo}`,
          });
        } else if (mod.status === 'failed' && mod.completedAt) {
          events.push({
            timestamp: mod.completedAt,
            level: 'error',
            message: `${label} 분석 실패: ${mod.errorMessage ?? '알 수 없는 오류'}`,
          });
        } else if (mod.status === 'running' && mod.startedAt) {
          events.push({
            timestamp: mod.startedAt,
            level: 'info',
            message: `${label} 분석 진행 중...`,
          });
        }
      }

      // 리포트 생성 이벤트
      if (reportDone && timeline.reportCompletedAt) {
        events.push({
          timestamp: timeline.reportCompletedAt,
          level: 'info',
          message: '종합 리포트 생성 완료',
        });
      }

      // 이벤트 시간순 정렬
      events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // --- 확장: 전체 진행률 (가중 퍼센트) ---
      const sourceEntries = Object.values(sourceDetails);
      const completedSources = sourceEntries.filter(s => s.status === 'completed').length;
      const totalSources = Math.max(sourceEntries.length, 1);
      const completedModules = analysisRows.filter(r => r.status === 'completed').length;
      const totalModules = Math.max(analysisRows.length, 1);

      const collectionProgress = collectionFailed ? 0 : (completedSources / totalSources) * 40;
      const analysisProgress = collectionFailed ? 0 : (completedModules / totalModules) * 50;
      const reportProgress = reportDone ? 10 : 0;
      const overallProgress = Math.round(collectionProgress + analysisProgress + reportProgress);

      // 경과 시간(초)
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
        sourceDetails,
        analysisModules,
        elapsedSeconds,
        // 확장 필드
        overallProgress,
        tokenUsage,
        timeline,
        analysisModulesDetailed,
        events,
      };
    }),
});
