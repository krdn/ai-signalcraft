import { and, between, desc, eq, inArray, sql } from 'drizzle-orm';
import { rawItems } from '../../../db/schema';
import { embedQuery } from '../../../services/embedding';
import { protectedProcedure } from '../init';
import { truncateContent } from '../items-postprocess';
import { fetchAnalysisPayloadInput, selectColumnsFor } from './_shared';

/**
 * fetchAnalysisPayload — 분석 측 단축 경로용 통합 RPC.
 *
 * 한 번의 RPC로 두 종류의 데이터를 함께 반환:
 *   - ragSample: RAG 의미검색으로 추린 분석 입력 (source별 분산 호출, dedup 후 합쳐짐)
 *   - fullset:   잡에 속한 전체 풀셋 (linkage 복원용, 본문 포함)
 *
 * 분석 측이 article_jobs/comment_jobs INSERT 시 풀셋이 필요하기 때문에 이 procedure를 추가했다
 * (job 271 사례 — linkage 0건 결함 수정).
 *
 * Phase 2(B-1): sources가 주어지면 source별로 ragSample을 분산 호출해 임베딩 거리 정렬에서 한 source가
 * 독식하는 비율 왜곡을 막는다.
 */
export const fetchAnalysisPayload = protectedProcedure
  .input(fetchAnalysisPayloadInput)
  .query(async ({ input, ctx }) => {
    const start = new Date(input.dateRange.start);
    const end = new Date(input.dateRange.end);

    // fullset: 윈도우 + subscriptionId(있으면) + sources(있으면, 'naver-news' 포함 시 'naver-comments'도 추가)
    const fullsetSources =
      input.sources?.length && input.sources.includes('naver-news')
        ? Array.from(new Set([...input.sources, 'naver-comments' as const]))
        : input.sources;
    const fullsetConds = [between(rawItems.time, start, end)];
    if (input.subscriptionId) fullsetConds.push(eq(rawItems.subscriptionId, input.subscriptionId));
    if (fullsetSources?.length) fullsetConds.push(inArray(rawItems.source, fullsetSources));

    const baseColumns = selectColumnsFor(rawItems);

    const fullsetRows = (await ctx.db
      .select(baseColumns)
      .from(rawItems)
      .where(and(...fullsetConds))
      .orderBy(desc(rawItems.time))
      .limit(50000)) as Array<Record<string, unknown>>;

    if (input.maxContentLength) truncateContent(fullsetRows, input.maxContentLength);

    // ragSample: ragOptions가 주어지면 source별 분산 RAG, 아니면 빈 배열.
    // articleVideoTopK / commentTopK는 각각 optional — 지정된 itemType에 대해서만 RAG 호출.
    // 미지정 itemType은 ragSample에 포함하지 않고, data-loader 측이 fullset으로 폴백한다.
    const ragSample: Array<Record<string, unknown>> = [];
    if (input.ragOptions) {
      const sources = input.sources?.length
        ? input.sources
        : (['naver-news', 'youtube', 'dcinside', 'fmkorea', 'clien'] as const);

      const articleTopK = input.ragOptions.articleVideoTopK;
      const commentTopK = input.ragOptions.commentTopK;
      const perSourceArticle = articleTopK
        ? Math.max(1, Math.ceil(articleTopK / sources.length))
        : 0;
      const perSourceComment = commentTopK
        ? Math.max(1, Math.ceil(commentTopK / sources.length))
        : 0;

      if (perSourceArticle > 0 || perSourceComment > 0) {
        const qvec = await embedQuery(input.keyword);
        const distExpr = sql<number>`${rawItems.embedding} <=> ${JSON.stringify(qvec)}::vector`;

        const sourceQueries = sources.flatMap((s) => {
          const articleSrcs = s === 'naver-news' ? ['naver-news'] : [s];
          const commentSrcs = s === 'naver-news' ? ['naver-comments'] : [s];
          const subCond = input.subscriptionId
            ? eq(rawItems.subscriptionId, input.subscriptionId)
            : sql`true`;
          const queries: Promise<Array<Record<string, unknown>>>[] = [];
          if (perSourceArticle > 0) {
            queries.push(
              ctx.db
                .select({ ...baseColumns, _distance: distExpr })
                .from(rawItems)
                .where(
                  and(
                    between(rawItems.time, start, end),
                    subCond,
                    inArray(rawItems.source, articleSrcs),
                    inArray(rawItems.itemType, ['article', 'video']),
                  ),
                )
                .orderBy(distExpr)
                .limit(perSourceArticle) as unknown as Promise<Array<Record<string, unknown>>>,
            );
          }
          if (perSourceComment > 0) {
            queries.push(
              ctx.db
                .select({ ...baseColumns, _distance: distExpr })
                .from(rawItems)
                .where(
                  and(
                    between(rawItems.time, start, end),
                    subCond,
                    inArray(rawItems.source, commentSrcs),
                    eq(rawItems.itemType, 'comment'),
                  ),
                )
                .orderBy(distExpr)
                .limit(perSourceComment) as unknown as Promise<Array<Record<string, unknown>>>,
            );
          }
          return queries;
        });
        const results = await Promise.all(sourceQueries);
        const seen = new Set<string>();
        for (const rows of results) {
          for (const r of rows) {
            const key = `${r.source}::${r.sourceId}::${r.itemType}`;
            if (seen.has(key)) continue;
            seen.add(key);
            ragSample.push(r);
          }
        }
        if (input.maxContentLength) truncateContent(ragSample, input.maxContentLength);
      }
    }

    // collectionMeta — source별 카운트
    const sourceCounts: Record<string, { articles: number; comments: number; videos: number }> = {};
    for (const r of fullsetRows) {
      const s = r.source as string;
      if (!sourceCounts[s]) sourceCounts[s] = { articles: 0, comments: 0, videos: 0 };
      if (r.itemType === 'article') sourceCounts[s].articles += 1;
      else if (r.itemType === 'comment') sourceCounts[s].comments += 1;
      else if (r.itemType === 'video') sourceCounts[s].videos += 1;
    }

    return {
      ragSample,
      fullset: fullsetRows,
      collectionMeta: {
        sources: Object.keys(sourceCounts),
        sourceCounts,
        window: { start: input.dateRange.start, end: input.dateRange.end },
        truncated: fullsetRows.length === 50000,
      },
    };
  });
