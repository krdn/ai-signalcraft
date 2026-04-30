// 파이프라인 Worker 핸들러 -- pipeline 큐 (normalize + persist)
import type { Job } from 'bullmq';
import { NaverCommentsCollector, YoutubeCommentsCollector } from '@ai-signalcraft/collectors';
import type {
  NaverComment,
  YoutubeComment,
  YoutubeVideo,
  DataSourceSnapshot,
} from '@ai-signalcraft/collectors';
import { updateJobProgress } from '../pipeline';
import { isPipelineCancelled } from '../pipeline/control';
import { createLogger } from '../utils/logger';
import { handleClassify } from './pipeline-worker-classify';
import { handlePersist } from './pipeline-worker-persist';

const logger = createLogger('pipeline-worker');

export function createPipelineHandler(): (job: Job) => Promise<any> {
  return async (job: Job) => {
    // dbJobId는 collection_jobs 테이블의 정수 PK -- flows.ts에서 모든 job data에 포함
    // IMPORTANT: parseInt(jobId) 패턴 사용 금지 -- flowId는 "collection-1711234567890" 형태
    const { source, dbJobId } = job.data;
    const jobStartTime = Date.now();
    logger.info(`[${job.name}] 시작 (dbJobId=${dbJobId})`);

    if (job.name.startsWith('normalize-')) {
      // 취소 확인
      if (dbJobId && (await isPipelineCancelled(dbJobId))) {
        logger.info(`[${job.name}] 취소됨 — 정규화 건너뜀`);
        return { skipped: true, reason: 'cancelled' };
      }

      // 자식 작업(collect)의 결과를 가져와 정규화
      const childValues = await job.getChildrenValues();
      const results: Record<string, unknown> = {};

      // normalize-feed-*: 동적 소스(RSS/HTML)는 여러 인스턴스가 같은 'rss'/'html' source를
      // 공유할 수 있으므로 key에 dataSourceSnapshot.id를 포함시켜 충돌을 방지한다.
      if (job.name.startsWith('normalize-feed-')) {
        const snapshot = job.data.dataSourceSnapshot as DataSourceSnapshot;
        for (const value of Object.values(childValues)) {
          const childResult = value as { source: string; items: unknown[]; count: number };
          results[`feed_${snapshot.id}`] = { ...childResult, dataSourceSnapshot: snapshot };
        }
      } else {
        for (const [_key, value] of Object.entries(childValues)) {
          const childResult = value as { source: string; items: unknown[]; count: number };
          results[childResult.source] = childResult;
        }
      }

      // normalize-naver: 기사 수집 결과에서 URL 추출 후 댓글 병렬 수집
      if (job.name === 'normalize-naver' && results['naver-news']) {
        const articles = (
          results['naver-news'] as { items: Array<{ url: string; title?: string }> }
        ).items;
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
        const CONCURRENCY = 4;
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

      // normalize-youtube: 일체형 수집기 결과 처리 (영상+댓글 분리)
      if (job.name === 'normalize-youtube' && results['youtube']) {
        const videos = (results['youtube'] as { items: YoutubeVideo[] }).items;
        const allComments: YoutubeComment[] = [];

        for (const video of videos) {
          allComments.push(...(video.comments ?? []));
          video.comments = [];
        }

        results['youtube-videos'] = {
          source: 'youtube-videos',
          items: videos,
          count: videos.length,
        };

        if (allComments.length > 0) {
          results['youtube-comments'] = {
            source: 'youtube-comments',
            items: allComments,
            count: allComments.length,
          };
        }

        if (dbJobId) {
          await updateJobProgress(dbJobId, {
            youtube: {
              status: 'completed',
              videos: videos.length,
              comments: allComments.length,
            },
          });
        }
      }

      // 하위 호환: 기존 YoutubeVideosCollector로 수집된 결과 처리
      // NOTE: 이 경로는 "신규 영상 수집 → 댓글 후처리" 전용이며, TTL 재사용된 영상은
      //       신규 YoutubeCollector(통합형)의 refetchCommentsOnly 경로에서 처리된다.
      //       따라서 여기서는 since 주입이 불필요 — 모든 영상이 신규 수집 대상이다.
      if (job.name === 'normalize-youtube' && results['youtube-videos'] && !results['youtube']) {
        const videos = (
          results['youtube-videos'] as { items: Array<{ sourceId: string; title?: string }> }
        ).items;
        const maxComments = (job.data.maxComments as number) ?? 500;
        const allComments: YoutubeComment[] = [];

        // 영상별 댓글 수집 진행 추적
        const videoDetails: Array<{ title: string; status: string; comments: number }> = videos
          .filter((v) => v.sourceId)
          .map((v) => ({
            title: (v.title || v.sourceId).slice(0, 50),
            status: 'pending',
            comments: 0,
          }));

        // 유효한 영상 필터
        const validVideos: Array<{ index: number; sourceId: string }> = [];
        for (let i = 0; i < videos.length; i++) {
          if (videos[i].sourceId) {
            validVideos.push({ index: i, sourceId: videos[i].sourceId });
          }
        }

        // 병렬 수집 -- 동시 3개 영상 댓글 수집 (YouTube API quota 고려)
        const YT_CONCURRENCY = 3;
        const updateYtProgress = async () => {
          if (dbJobId) {
            await updateJobProgress(dbJobId, {
              youtube: {
                status: 'running',
                videos: videos.length,
                comments: allComments.length,
                videoDetails,
              },
            });
          }
        };

        const collectVideoComments = async (item: { index: number; sourceId: string }) => {
          const detail = videoDetails[item.index];
          detail.status = 'running';
          const collector = new YoutubeCommentsCollector();
          const videoComments: YoutubeComment[] = [];

          try {
            for await (const chunk of collector.collect({
              keyword: item.sourceId,
              startDate: job.data.startDate ?? '',
              endDate: job.data.endDate ?? '',
              maxComments,
            })) {
              videoComments.push(...chunk);
              detail.comments = videoComments.length;
              await updateYtProgress();
            }
            detail.status = 'completed';
          } catch (err) {
            // 부분 실패 허용 -- 개별 영상 댓글 실패 시 로깅 후 계속
            logger.warn(
              `[youtube-comments] 영상 댓글 수집 실패 (${item.sourceId}):`,
              err instanceof Error ? err.message : err,
            );
            detail.status = 'failed';
          }
          return videoComments;
        };

        // semaphore: YT_CONCURRENCY개씩 배치 처리
        for (let batchStart = 0; batchStart < validVideos.length; batchStart += YT_CONCURRENCY) {
          // 배치 시작 전 취소 확인 — 유튜브 댓글 수집 중 즉시 중단
          if (dbJobId && (await isPipelineCancelled(dbJobId))) {
            logger.info(
              `[normalize-youtube] 댓글 수집 중 취소됨 (${allComments.length}건 수집 후)`,
            );
            break;
          }

          const batch = validVideos.slice(batchStart, batchStart + YT_CONCURRENCY);
          const batchResults = await Promise.allSettled(batch.map(collectVideoComments));

          for (const result of batchResults) {
            if (result.status === 'fulfilled' && result.value.length > 0) {
              allComments.push(...result.value);
            }
          }

          await job.updateProgress({ commentsCollected: allComments.length });
          await updateYtProgress();
        }

        if (allComments.length > 0) {
          results['youtube-comments'] = {
            source: 'youtube-comments',
            items: allComments,
            count: allComments.length,
          };
        }

        // 유튜브 수집 완료 상태로 업데이트
        if (dbJobId) {
          await updateJobProgress(dbJobId, {
            youtube: {
              status: 'completed',
              videos: videos.length,
              comments: allComments.length,
              videoDetails,
            },
          });
        }
      }

      // normalize-community: 커뮤니티 수집 결과 (게시글에 댓글이 이미 포함됨)
      if (job.name.startsWith('normalize-community')) {
        // 커뮤니티 수집기는 게시글+댓글을 함께 수집하므로 별도 댓글 수집 불필요
        // results에 각 커뮤니티 소스 결과가 담겨 있음
      }

      const normalizeElapsed = ((Date.now() - jobStartTime) / 1000).toFixed(1);
      logger.info(`[${job.name}] 완료: ${normalizeElapsed}초 소요`);
      return { source, dbJobId, normalized: true, results };
    }

    if (job.name === 'persist') {
      return handlePersist(job, jobStartTime);
    }

    // classify 분기: 증분 개별 감정 분석 + triggerAnalysis
    if (job.name === 'classify') {
      return handleClassify(job);
    }
  };
}
