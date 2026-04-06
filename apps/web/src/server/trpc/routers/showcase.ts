import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { collectionJobs, analysisResults, analysisReports } from '@ai-signalcraft/core';
import { publicProcedure, router } from '../init';

// progress JSONB에서 소스별 수집 통계 추출
function extractSourceStats(progress: Record<string, unknown> | null) {
  if (!progress) return { totalArticles: 0, totalComments: 0 };
  let totalArticles = 0;
  let totalComments = 0;
  const skipKeys = ['_events', 'item-analysis', 'token-optimization', 'report'];
  for (const [key, val] of Object.entries(progress)) {
    if (skipKeys.includes(key) || typeof val !== 'object' || !val) continue;
    const src = val as Record<string, number>;
    totalArticles += (src.articles ?? 0) + (src.videos ?? 0) + (src.posts ?? 0);
    totalComments += src.comments ?? 0;
  }
  return { totalArticles, totalComments };
}

export const showcaseRouter = router({
  // 공개 쇼케이스 목록 (비로그인 허용) — 요약 통계 포함
  list: publicProcedure.query(async ({ ctx }) => {
    const items = await ctx.db
      .select({
        jobId: collectionJobs.id,
        keyword: collectionJobs.keyword,
        startDate: collectionJobs.startDate,
        endDate: collectionJobs.endDate,
        featuredAt: collectionJobs.featuredAt,
        createdAt: collectionJobs.createdAt,
        updatedAt: collectionJobs.updatedAt,
        progress: collectionJobs.progress,
        reportTitle: analysisReports.title,
        oneLiner: analysisReports.oneLiner,
        metadata: analysisReports.metadata,
      })
      .from(collectionJobs)
      .leftJoin(analysisReports, eq(analysisReports.jobId, collectionJobs.id))
      .where(and(eq(collectionJobs.isFeatured, true), eq(collectionJobs.status, 'completed')))
      .orderBy(desc(collectionJobs.featuredAt))
      .limit(5);

    return items.map((item) => {
      const meta = item.metadata as Record<string, unknown> | null;
      const { totalArticles, totalComments } = extractSourceStats(
        item.progress as Record<string, unknown> | null,
      );
      const modulesCompleted = (meta?.modulesCompleted as string[]) ?? [];
      return {
        jobId: item.jobId,
        keyword: item.keyword,
        startDate: item.startDate,
        endDate: item.endDate,
        featuredAt: item.featuredAt,
        createdAt: item.createdAt,
        reportTitle: item.reportTitle,
        oneLiner: item.oneLiner,
        metadata: meta ? { dateRange: meta.dateRange, modulesCompleted } : null,
        // 요약 통계
        totalArticles,
        totalComments,
        modulesCompleted: modulesCompleted.length,
        modulesTotal: modulesCompleted.length, // 완료 작업이므로 동일
      };
    });
  }),

  // 쇼케이스 항목의 모듈별 분석 결과 (비로그인 허용)
  getResults: publicProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input, ctx }) => {
      // isFeatured 가드
      const [job] = await ctx.db
        .select({ id: collectionJobs.id })
        .from(collectionJobs)
        .where(and(eq(collectionJobs.id, input.jobId), eq(collectionJobs.isFeatured, true)))
        .limit(1);

      if (!job) return [];

      return ctx.db
        .select({
          module: analysisResults.module,
          status: analysisResults.status,
          result: analysisResults.result,
        })
        .from(analysisResults)
        .where(eq(analysisResults.jobId, input.jobId));
    }),

  // 쇼케이스 항목의 리포트 (비로그인 허용)
  getReport: publicProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input, ctx }) => {
      // isFeatured 가드
      const [job] = await ctx.db
        .select({ id: collectionJobs.id })
        .from(collectionJobs)
        .where(and(eq(collectionJobs.id, input.jobId), eq(collectionJobs.isFeatured, true)))
        .limit(1);

      if (!job) return null;

      const [report] = await ctx.db
        .select({
          title: analysisReports.title,
          oneLiner: analysisReports.oneLiner,
          markdownContent: analysisReports.markdownContent,
          metadata: analysisReports.metadata,
        })
        .from(analysisReports)
        .where(eq(analysisReports.jobId, input.jobId))
        .limit(1);

      return report ?? null;
    }),

  // 쇼케이스 항목 상세 (소스별 수집, 모듈별 분석 정보)
  getDetail: publicProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input, ctx }) => {
      // isFeatured 가드 + 필요 데이터 조회
      const [job] = await ctx.db
        .select({
          id: collectionJobs.id,
          keyword: collectionJobs.keyword,
          progress: collectionJobs.progress,
          createdAt: collectionJobs.createdAt,
          updatedAt: collectionJobs.updatedAt,
          reportTitle: analysisReports.title,
          oneLiner: analysisReports.oneLiner,
          reportCreatedAt: analysisReports.createdAt,
        })
        .from(collectionJobs)
        .leftJoin(analysisReports, eq(analysisReports.jobId, collectionJobs.id))
        .where(and(eq(collectionJobs.id, input.jobId), eq(collectionJobs.isFeatured, true)))
        .limit(1);

      if (!job) return null;

      // 모듈별 분석 결과 조회
      const modules = await ctx.db
        .select({
          module: analysisResults.module,
          status: analysisResults.status,
          usage: analysisResults.usage,
          createdAt: analysisResults.createdAt,
          updatedAt: analysisResults.updatedAt,
        })
        .from(analysisResults)
        .where(eq(analysisResults.jobId, input.jobId));

      // progress에서 소스별 수집 통계
      const progress = job.progress as Record<string, unknown> | null;
      const skipKeys = ['_events', 'item-analysis', 'token-optimization', 'report'];
      const sourceLabels: Record<string, string> = {
        naver: '네이버 뉴스',
        youtube: '유튜브',
        dcinside: 'DC갤러리',
        fmkorea: '에펨코리아',
        clien: '클리앙',
      };

      const sources: Array<{
        key: string;
        label: string;
        articles: number;
        comments: number;
      }> = [];

      if (progress) {
        for (const [key, val] of Object.entries(progress)) {
          if (skipKeys.includes(key) || typeof val !== 'object' || !val) continue;
          const src = val as Record<string, number>;
          sources.push({
            key,
            label: sourceLabels[key] ?? key,
            articles: (src.articles ?? 0) + (src.videos ?? 0) + (src.posts ?? 0),
            comments: src.comments ?? 0,
          });
        }
      }

      // 통계 집계
      const totalArticles = sources.reduce((s, v) => s + v.articles, 0);
      const totalComments = sources.reduce((s, v) => s + v.comments, 0);
      const completedModules = modules.filter((m) => m.status === 'completed');
      const totalTokens = completedModules.reduce((s, m) => {
        const u = m.usage as { totalTokens?: number } | null;
        return s + (u?.totalTokens ?? 0);
      }, 0);

      // 소요시간 (작업 생성 ~ 리포트 생성 또는 마지막 업데이트)
      const endTime = job.reportCreatedAt ?? job.updatedAt;
      const durationSeconds = endTime
        ? Math.round((new Date(endTime).getTime() - new Date(job.createdAt).getTime()) / 1000)
        : 0;

      // 파이프라인 단계 (완료된 작업이므로 모두 completed)
      const pipelineStages = [
        { key: 'collection', label: '수집' },
        { key: 'normalization', label: '정규화' },
        { key: 'token-optimization', label: '토큰 최적화' },
        { key: 'item-analysis', label: '개별 감정' },
        { key: 'analysis', label: 'AI 분석' },
        { key: 'report', label: '리포트' },
      ].map((stage) => {
        const p = progress?.[stage.key] as { status?: string } | undefined;
        return {
          ...stage,
          status: (p?.status === 'skipped' ? 'skipped' : 'completed') as 'completed' | 'skipped',
        };
      });

      // 모듈별 상세 (Stage 매핑)
      const moduleStageMap: Record<string, number> = {
        'macro-view': 1,
        segmentation: 1,
        'sentiment-framing': 1,
        'message-impact': 1,
        'risk-map': 2,
        opportunity: 2,
        strategy: 2,
        'final-summary': 3,
        'approval-rating': 4,
        'frame-war': 4,
        'crisis-scenario': 4,
        'win-simulation': 4,
      };
      const moduleLabels: Record<string, string> = {
        'sentiment-framing': '감정 프레이밍',
        'macro-view': '거시 분석',
        segmentation: '세그멘테이션',
        'message-impact': '메시지 임팩트',
        'risk-map': '리스크 맵',
        opportunity: '기회 발굴',
        strategy: '전략 제안',
        'final-summary': '종합 요약',
        'approval-rating': '지지율 분석',
        'frame-war': '프레임 전쟁',
        'crisis-scenario': '위기 시나리오',
        'win-simulation': '승리 시뮬레이션',
      };
      const stageLabels: Record<number, string> = {
        1: 'Stage 1 — 기초 분석',
        2: 'Stage 2 — 심층 분석',
        3: 'Stage 3 — 종합 요약',
        4: 'Stage 4 — 고급 분석',
      };

      const analysisModules = modules
        .filter((m) => m.status === 'completed')
        .map((m) => {
          const usage = m.usage as {
            totalTokens?: number;
            provider?: string;
            model?: string;
          } | null;
          const stage = moduleStageMap[m.module] ?? 0;
          const dur =
            m.updatedAt && m.createdAt
              ? Math.round(
                  (new Date(m.updatedAt).getTime() - new Date(m.createdAt).getTime()) / 1000,
                )
              : null;
          return {
            module: m.module,
            label: moduleLabels[m.module] ?? m.module,
            stage,
            stageLabel: stageLabels[stage] ?? '',
            provider: usage?.provider ?? '',
            model: usage?.model ?? '',
            totalTokens: usage?.totalTokens ?? 0,
            durationSeconds: dur,
          };
        })
        .sort((a, b) => a.stage - b.stage);

      return {
        keyword: job.keyword,
        stats: {
          totalArticles,
          totalComments,
          modulesCompleted: completedModules.length,
          modulesTotal: modules.length,
          totalTokens,
          durationSeconds,
        },
        pipelineStages,
        sources,
        analysisModules,
        report: job.reportTitle ? { title: job.reportTitle, oneLiner: job.oneLiner } : null,
      };
    }),
});
