// 파이프라인 Worker 핸들러 -- pipeline 큐 (normalize + persist)
import type { Job } from 'bullmq';
import { NaverCommentsCollector, YoutubeCommentsCollector } from '@ai-signalcraft/collectors';
import type {
  NaverComment,
  YoutubeComment,
  CommunityPost,
  DataSourceSnapshot,
} from '@ai-signalcraft/collectors';
import { eq } from 'drizzle-orm';
import {
  normalizeNaverArticle,
  normalizeNaverComment,
  normalizeYoutubeVideo,
  normalizeYoutubeComment,
  normalizeCommunityPost,
  normalizeCommunityComment,
  normalizeFeedArticle,
  persistArticles,
  persistVideos,
  persistComments,
  updateJobProgress,
} from '../pipeline';
import { getDb } from '../db';
import { dataSources } from '../db/schema/sources';
import { isPipelineCancelled } from '../pipeline/control';
import { awaitStageGate } from '../pipeline/pipeline-checks';
import { createLogger } from '../utils/logger';
import { triggerAnalysis } from './flows';
import { COMMUNITY_SOURCES } from './worker-config';

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

          try {
            for await (const chunk of collector.collectForArticle(item.url, { maxComments })) {
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

      // normalize-youtube: 영상 수집 결과에서 videoId 추출 후 댓글 병렬 수집
      if (job.name === 'normalize-youtube' && results['youtube-videos']) {
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
      // 취소 확인
      if (dbJobId && (await isPipelineCancelled(dbJobId))) {
        logger.info(`[persist] 취소됨 — 저장 건너뜀`);
        return { skipped: true, reason: 'cancelled' };
      }

      // BP 게이트: 수집 완료 후 (모든 children 완료 후 persist 진입 전)
      if (dbJobId && !(await awaitStageGate(dbJobId, 'collection'))) {
        return { cancelled: true };
      }

      // 자식 작업(normalize)의 결과를 가져와 DB에 저장
      const childValues = await job.getChildrenValues();

      for (const [_key, value] of Object.entries(childValues)) {
        const normalizeResult = value as any;
        const results = normalizeResult.results || {};
        // dbJobId를 normalize 결과에서도 가져올 수 있지만, persist job 자체의 data에서 사용
        const jobIdForDb: number = normalizeResult.dbJobId ?? dbJobId;

        // IMPORTANT: 기사/영상을 먼저 persist하여 DB ID를 확보한 후,
        // sourceId -> dbId 매핑 테이블을 생성하여 댓글의 articleId/videoId FK를 올바르게 연결
        const articleSourceToDbId = new Map<string, number>();
        const videoSourceToDbId = new Map<string, number>();

        // Step 1: 기사 persist -> sourceId->dbId 매핑 생성
        if (results['naver-news']) {
          const articleItems = (results['naver-news'] as any).items || [];
          const normalized = articleItems.map((a: any) => normalizeNaverArticle(a));
          const persisted = await persistArticles(jobIdForDb, normalized);
          for (const row of persisted) {
            articleSourceToDbId.set(row.sourceId, row.id);
          }
        }

        // Step 2: 영상 persist -> sourceId->dbId 매핑 생성
        if (results['youtube-videos']) {
          const videoItems = (results['youtube-videos'] as any).items || [];
          const normalized = videoItems.map((v: any) => normalizeYoutubeVideo(v));
          const persisted = await persistVideos(jobIdForDb, normalized);
          for (const row of persisted) {
            videoSourceToDbId.set(row.sourceId, row.id);
          }
        }

        // Step 3: 네이버 댓글 persist -- articleSourceToDbId 매핑으로 FK 연결
        if (results['naver-comments']) {
          const commentItems = (results['naver-comments'] as any).items || [];
          const normalized = commentItems.map((c: any) => {
            const articleDbId = articleSourceToDbId.get(c.articleSourceId);
            return normalizeNaverComment(c, articleDbId);
          });
          await persistComments(jobIdForDb, normalized);
        }

        // Step 4: 유튜브 댓글 persist -- videoSourceToDbId 매핑으로 FK 연결
        if (results['youtube-comments']) {
          const commentItems = (results['youtube-comments'] as any).items || [];
          const normalized = commentItems.map((c: any) => {
            const videoDbId = videoSourceToDbId.get(c.videoSourceId);
            return normalizeYoutubeComment(c, videoDbId);
          });
          await persistComments(jobIdForDb, normalized);
        }

        // Step 5: 커뮤니티 게시글+댓글 persist
        for (const communitySource of COMMUNITY_SOURCES) {
          if (!results[communitySource]) continue;

          const postItems = ((results[communitySource] as any).items as CommunityPost[]) || [];
          // Step 5a: 게시글 persist -> sourceId->dbId 매핑
          const normalizedPosts = postItems.map((p: CommunityPost) =>
            normalizeCommunityPost(p, communitySource),
          );
          const persistedPosts = await persistArticles(jobIdForDb, normalizedPosts);
          const communityArticleMap = new Map<string, number>();
          for (const row of persistedPosts) {
            communityArticleMap.set(row.sourceId, row.id);
          }

          // Step 5b: 댓글 persist -- 게시글 FK 연결
          const allCommunityComments = postItems.flatMap((p: CommunityPost) =>
            (p.comments || []).map((c) => {
              const articleDbId = communityArticleMap.get(p.sourceId);
              return normalizeCommunityComment(c, communitySource, articleDbId);
            }),
          );
          if (allCommunityComments.length > 0) {
            await persistComments(jobIdForDb, allCommunityComments);
          }
        }

        // Step 6: 동적 소스 (RSS/HTML) persist
        // normalize-feed-* 에서 만든 `feed_<uuid>` 키를 찾아 처리
        for (const [key, value] of Object.entries(results)) {
          if (!key.startsWith('feed_')) continue;
          const feedResult = value as {
            items: unknown[];
            dataSourceSnapshot: DataSourceSnapshot;
          };
          const snapshot = feedResult.dataSourceSnapshot;
          const normalized = (feedResult.items as any[]).map((item) =>
            normalizeFeedArticle(item, snapshot),
          );
          if (normalized.length > 0) {
            await persistArticles(jobIdForDb, normalized);
          }
          // lastCollectedAt 갱신 — 관리 UI에 표시
          try {
            await getDb()
              .update(dataSources)
              .set({ lastCollectedAt: new Date(), updatedAt: new Date() })
              .where(eq(dataSources.id, snapshot.id));
          } catch (err) {
            logger.warn(`[persist] data_sources.lastCollectedAt 갱신 실패 (${snapshot.id}):`, err);
          }
        }
      }

      // D-06: 최종 상태 업데이트 -- dbJobId는 number이므로 parseInt 불필요
      await updateJobProgress(dbJobId, {}, 'completed');

      const persistElapsed = ((Date.now() - jobStartTime) / 1000).toFixed(1);
      logger.info(`[persist] 완료: ${persistElapsed}초 소요 (dbJobId=${dbJobId})`);

      // D-09: 수집 완료 후 자동 분석 트리거
      // 취소 확인 — persist 완료 후에도 취소되었으면 분석 트리거하지 않음
      const keyword = job.data.keyword;
      if (keyword) {
        if (dbJobId && (await isPipelineCancelled(dbJobId))) {
          logger.info(`[persist] 취소됨 — 분석 트리거 건너뜀 (dbJobId=${dbJobId})`);
        } else {
          // BP 게이트: 정규화 완료 후 (analysis 트리거 직전)
          if (dbJobId && !(await awaitStageGate(dbJobId, 'normalize'))) {
            return { cancelled: true };
          }
          await triggerAnalysis(dbJobId, keyword);
          logger.info(`분석 파이프라인 트리거됨: job=${dbJobId}, keyword=${keyword}`);
        }
      }

      return { persisted: true };
    }
  };
}
