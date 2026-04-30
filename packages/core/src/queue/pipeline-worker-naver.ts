// normalize-naver: 기사 결과에서 URL 추출 후 댓글 병렬 수집 (semaphore CONCURRENCY=4)
import type { Job } from 'bullmq';
import { NaverCommentsCollector } from '@ai-signalcraft/collectors';
import type { NaverComment } from '@ai-signalcraft/collectors';
import { updateJobProgress } from '../pipeline';
import { isPipelineCancelled } from '../pipeline/control';
import { createLogger } from '../utils/logger';

const logger = createLogger('pipeline-worker');

const CONCURRENCY = 4;

export async function collectNaverCommentsForArticles(
  job: Job,
  results: Record<string, unknown>,
): Promise<void> {
  const { dbJobId } = job.data;
  if (!results['naver-news']) return;

  const articles = (results['naver-news'] as { items: Array<{ url: string; title?: string }> })
    .items;
  const maxComments = (job.data.maxComments as number) ?? 500;
  const allComments: NaverComment[] = [];

  // 재사용된 기사의 since 맵 — 이 URL들은 댓글만 증분으로 새로 긁는다
  const refetchSpecs = (job.data.reusePlan?.refetchCommentsFor ?? []) as Array<{
    url: string;
    articleId?: number;
    lastCommentsFetchedAt: string | null;
  }>;
  const urlToSince = new Map<string, Date | null>(
    refetchSpecs.map((s) => [
      s.url,
      s.lastCommentsFetchedAt ? new Date(s.lastCommentsFetchedAt) : null,
    ]),
  );

  // 기사별 댓글 수집 진행 추적
  const articleDetails: Array<{ title: string; status: string; comments: number }> = articles
    .filter((a) => a.url)
    .map((a) => ({ title: (a.title || a.url).slice(0, 50), status: 'pending', comments: 0 }));

  // 네이버뉴스 URL만 필터 (외부 언론사 URL은 네이버 댓글 API 미지원)
  const naverArticles: Array<{ index: number; url: string }> = [];
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    if (!article.url) continue;
    if (!article.url.includes('n.news.naver.com')) {
      articleDetails[i].status = 'completed';
      articleDetails[i].comments = 0;
      continue;
    }
    naverArticles.push({ index: i, url: article.url });
  }

  // 병렬 수집 -- 동시 4개 기사 댓글 수집 (semaphore 패턴)
  const updateProgress = async () => {
    if (dbJobId) {
      await updateJobProgress(dbJobId, {
        naver: {
          status: 'running',
          articles: articles.length,
          comments: allComments.length,
          articleDetails,
        },
      });
    }
  };

  const collectArticleComments = async (item: { index: number; url: string }) => {
    const detail = articleDetails[item.index];
    detail.status = 'running';
    const collector = new NaverCommentsCollector();
    const articleComments: NaverComment[] = [];
    // 재사용 대상이면 since 전달, 신규 기사면 전량 수집
    const since = urlToSince.get(item.url) ?? undefined;

    try {
      for await (const chunk of collector.collectForArticle(item.url, {
        maxComments,
        since: since ?? undefined,
      })) {
        articleComments.push(...chunk);
        detail.comments = articleComments.length;
        await updateProgress();
      }
      detail.status = 'completed';
    } catch (err) {
      // D-04: 부분 실패 허용 -- 개별 기사 댓글 실패 시 로깅 후 계속
      logger.warn(`댓글 수집 실패 (${item.url}):`, err);
      detail.status = 'failed';
    }
    return articleComments;
  };

  // semaphore: CONCURRENCY개씩 배치 처리
  for (let batchStart = 0; batchStart < naverArticles.length; batchStart += CONCURRENCY) {
    // 배치 시작 전 취소 확인 — 네이버 댓글 수집 중 즉시 중단
    if (dbJobId && (await isPipelineCancelled(dbJobId))) {
      logger.info(`[normalize-naver] 댓글 수집 중 취소됨 (${allComments.length}건 수집 후)`);
      break;
    }

    const batch = naverArticles.slice(batchStart, batchStart + CONCURRENCY);
    const batchResults = await Promise.allSettled(batch.map(collectArticleComments));

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        allComments.push(...result.value);
      }
    }

    await job.updateProgress({ commentsCollected: allComments.length });
    await updateProgress();
  }

  if (allComments.length > 0) {
    results['naver-comments'] = {
      source: 'naver-comments',
      items: allComments,
      count: allComments.length,
    };
  }

  // 네이버 수집 완료 상태로 업데이트
  if (dbJobId) {
    await updateJobProgress(dbJobId, {
      naver: {
        status: 'completed',
        articles: articles.length,
        comments: allComments.length,
        articleDetails,
      },
    });
  }
}
