// 파이프라인 Worker 핸들러 -- pipeline 큐 (normalize + persist)
import type { Job } from 'bullmq';
import {
  NaverCommentsCollector,
  YoutubeCommentsCollector,
} from '@ai-signalcraft/collectors';
import type { NaverComment, YoutubeComment, CommunityPost, Tweet } from '@ai-signalcraft/collectors';
import {
  normalizeNaverArticle,
  normalizeNaverComment,
  normalizeYoutubeVideo,
  normalizeYoutubeComment,
  normalizeCommunityPost,
  normalizeCommunityComment,
  normalizeTweet,
  normalizeTweetReply,
  persistArticles,
  persistVideos,
  persistComments,
  updateJobProgress,
} from '../pipeline';
import { triggerAnalysis } from './flows';
import { COMMUNITY_SOURCES } from './worker-config';
import { createLogger } from '../utils/logger';

const logger = createLogger('pipeline-worker');

export function createPipelineHandler(): (job: Job) => Promise<any> {
  return async (job: Job) => {
    // dbJobId는 collection_jobs 테이블의 정수 PK -- flows.ts에서 모든 job data에 포함
    // IMPORTANT: parseInt(jobId) 패턴 사용 금지 -- flowId는 "collection-1711234567890" 형태
    const { source, dbJobId } = job.data;

    if (job.name.startsWith('normalize-')) {
      // 자식 작업(collect)의 결과를 가져와 정규화
      const childValues = await job.getChildrenValues();
      const results: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(childValues)) {
        const childResult = value as { source: string; items: unknown[]; count: number };
        results[childResult.source] = childResult;
      }

      // normalize-naver: 기사 수집 결과에서 URL 추출 후 댓글 수집
      if (job.name === 'normalize-naver' && results['naver-news']) {
        const articles = (results['naver-news'] as { items: Array<{ url: string; title?: string }> }).items;
        const maxComments = (job.data.maxComments as number) ?? 500;
        const commentsCollector = new NaverCommentsCollector();
        const allComments: NaverComment[] = [];

        // 기사별 댓글 수집 진행 추적
        const articleDetails: Array<{ title: string; status: string; comments: number }> = articles
          .filter(a => a.url)
          .map(a => ({ title: (a.title || a.url).slice(0, 50), status: 'pending', comments: 0 }));

        for (let i = 0; i < articles.length; i++) {
          const article = articles[i];
          if (!article.url) continue;

          const detail = articleDetails[i];

          // 네이버 뉴스 URL이 아닌 기사는 댓글 수집 스킵 (외부 언론사 URL은 네이버 댓글 API 미지원)
          if (!article.url.includes('n.news.naver.com')) {
            detail.status = 'completed';
            detail.comments = 0;
            continue;
          }

          detail.status = 'running';
          let articleCommentCount = 0;

          try {
            for await (const chunk of commentsCollector.collectForArticle(article.url, { maxComments })) {
              allComments.push(...chunk);
              articleCommentCount += chunk.length;
              detail.comments = articleCommentCount;

              // DB: 기사별 댓글 실시간 진행
              if (dbJobId) {
                await updateJobProgress(dbJobId, {
                  naver: {
                    status: 'running',
                    articles: articles.length,
                    comments: allComments.length,
                    articleDetails,
                  }
                });
              }
            }
            detail.status = 'completed';
          } catch (err) {
            // D-04: 부분 실패 허용 -- 개별 기사 댓글 실패 시 로깅 후 계속
            logger.warn(`댓글 수집 실패 (${article.url}):`, err);
            detail.status = 'failed';
          }
          await job.updateProgress({ commentsCollected: allComments.length });

          // DB: 기사 완료/실패 후 진행 업데이트
          if (dbJobId) {
            await updateJobProgress(dbJobId, {
              naver: {
                status: 'running',
                articles: articles.length,
                comments: allComments.length,
                articleDetails,
              }
            });
          }
        }

        if (allComments.length > 0) {
          results['naver-comments'] = { source: 'naver-comments', items: allComments, count: allComments.length };
        }

        // 네이버 수집 완료 상태로 업데이트
        if (dbJobId) {
          await updateJobProgress(dbJobId, {
            naver: {
              status: 'completed',
              articles: articles.length,
              comments: allComments.length,
              articleDetails,
            }
          });
        }
      }

      // normalize-youtube: 영상 수집 결과에서 videoId 추출 후 댓글 순차 수집
      if (job.name === 'normalize-youtube' && results['youtube-videos']) {
        const videos = (results['youtube-videos'] as { items: Array<{ sourceId: string; title?: string }> }).items;
        const maxComments = (job.data.maxComments as number) ?? 500;
        const commentsCollector = new YoutubeCommentsCollector();
        const allComments: YoutubeComment[] = [];

        // 영상별 댓글 수집 진행 추적
        const videoDetails: Array<{ title: string; status: string; comments: number }> = videos
          .filter(v => v.sourceId)
          .map(v => ({ title: (v.title || v.sourceId).slice(0, 50), status: 'pending', comments: 0 }));

        for (let i = 0; i < videos.length; i++) {
          const video = videos[i];
          if (!video.sourceId) continue;

          const detail = videoDetails[i];
          detail.status = 'running';
          let videoCommentCount = 0;

          try {
            for await (const chunk of commentsCollector.collect({ keyword: video.sourceId, startDate: job.data.startDate ?? '', endDate: job.data.endDate ?? '', maxComments })) {
              allComments.push(...chunk);
              videoCommentCount += chunk.length;
              detail.comments = videoCommentCount;

              // DB: 영상별 댓글 실시간 진행
              if (dbJobId) {
                await updateJobProgress(dbJobId, {
                  youtube: {
                    status: 'running',
                    videos: videos.length,
                    comments: allComments.length,
                    videoDetails,
                  }
                });
              }
            }
            detail.status = 'completed';
          } catch (err) {
            // 부분 실패 허용 -- 개별 영상 댓글 실패 시 로깅 후 계속
            logger.warn(`[youtube-comments] 영상 댓글 수집 실패 (${video.sourceId}):`, err instanceof Error ? err.message : err);
            detail.status = 'failed';
          }
          await job.updateProgress({ commentsCollected: allComments.length });
        }

        if (allComments.length > 0) {
          results['youtube-comments'] = { source: 'youtube-comments', items: allComments, count: allComments.length };
        }

        // 유튜브 수집 완료 상태로 업데이트
        if (dbJobId) {
          await updateJobProgress(dbJobId, {
            youtube: {
              status: 'completed',
              videos: videos.length,
              comments: allComments.length,
              videoDetails,
            }
          });
        }
      }

      // normalize-community: 커뮤니티 수집 결과 (게시글에 댓글이 이미 포함됨)
      if (job.name.startsWith('normalize-community')) {
        // 커뮤니티 수집기는 게시글+댓글을 함께 수집하므로 별도 댓글 수집 불필요
      }

      // normalize-twitter: 트윗 수집 결과 (리플은 현재 빈 배열)
      if (job.name === 'normalize-twitter') {
        // Twitter 수집기는 트윗을 직접 수집하므로 별도 처리 불필요
      }

      return { source, dbJobId, normalized: true, results };
    }

    if (job.name === 'persist') {
      // 자식 작업(normalize)의 결과를 가져와 DB에 저장
      const childValues = await job.getChildrenValues();

      for (const [key, value] of Object.entries(childValues)) {
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
          const normalized = articleItems.map((a: any) => normalizeNaverArticle(a, jobIdForDb));
          const persisted = await persistArticles(normalized);
          for (const row of persisted) {
            articleSourceToDbId.set(row.sourceId, row.id);
          }
        }

        // Step 2: 영상 persist -> sourceId->dbId 매핑 생성
        if (results['youtube-videos']) {
          const videoItems = (results['youtube-videos'] as any).items || [];
          const normalized = videoItems.map((v: any) => normalizeYoutubeVideo(v, jobIdForDb));
          const persisted = await persistVideos(normalized);
          for (const row of persisted) {
            videoSourceToDbId.set(row.sourceId, row.id);
          }
        }

        // Step 3: 네이버 댓글 persist -- articleSourceToDbId 매핑으로 FK 연결
        if (results['naver-comments']) {
          const commentItems = (results['naver-comments'] as any).items || [];
          const normalized = commentItems.map((c: any) => {
            const articleDbId = articleSourceToDbId.get(c.articleSourceId);
            return normalizeNaverComment(c, jobIdForDb, articleDbId);
          });
          await persistComments(normalized);
        }

        // Step 4: 유튜브 댓글 persist -- videoSourceToDbId 매핑으로 FK 연결
        if (results['youtube-comments']) {
          const commentItems = (results['youtube-comments'] as any).items || [];
          const normalized = commentItems.map((c: any) => {
            const videoDbId = videoSourceToDbId.get(c.videoSourceId);
            return normalizeYoutubeComment(c, jobIdForDb, videoDbId);
          });
          await persistComments(normalized);
        }

        // Step 5: 커뮤니티 게시글+댓글 persist
        for (const communitySource of COMMUNITY_SOURCES) {
          if (!results[communitySource]) continue;

          const postItems = (results[communitySource] as any).items as CommunityPost[] || [];
          // Step 5a: 게시글 persist -> sourceId->dbId 매핑
          const normalizedPosts = postItems.map((p: CommunityPost) =>
            normalizeCommunityPost(p, jobIdForDb, communitySource),
          );
          const persistedPosts = await persistArticles(normalizedPosts);
          const communityArticleMap = new Map<string, number>();
          for (const row of persistedPosts) {
            communityArticleMap.set(row.sourceId, row.id);
          }

          // Step 5b: 댓글 persist -- 게시글 FK 연결
          const allCommunityComments = postItems.flatMap((p: CommunityPost) =>
            (p.comments || []).map((c) => {
              const articleDbId = communityArticleMap.get(p.sourceId);
              return normalizeCommunityComment(c, jobIdForDb, communitySource, articleDbId);
            }),
          );
          if (allCommunityComments.length > 0) {
            await persistComments(allCommunityComments);
          }
        }

        // Step 6: Twitter 트윗 persist
        if (results['twitter']) {
          const tweetItems = (results['twitter'] as any).items as Tweet[] || [];
          const normalizedTweets = tweetItems.map((t: Tweet) => normalizeTweet(t, jobIdForDb));
          const persistedTweets = await persistArticles(normalizedTweets);
          const tweetArticleMap = new Map<string, number>();
          for (const row of persistedTweets) {
            tweetArticleMap.set(row.sourceId, row.id);
          }
          // 리플 persist (현재 빈 배열이지만 향후 확장 대비)
          const allReplies = tweetItems.flatMap((t: Tweet) =>
            (t.replies || []).map((r) => {
              const articleDbId = tweetArticleMap.get(t.sourceId);
              return normalizeTweetReply(r, jobIdForDb, articleDbId);
            }),
          );
          if (allReplies.length > 0) {
            await persistComments(allReplies);
          }
        }
      }

      // D-06: 최종 상태 업데이트 -- dbJobId는 number이므로 parseInt 불필요
      await updateJobProgress(dbJobId, {}, 'completed');

      // D-09: 수집 완료 후 자동 분석 트리거
      const keyword = job.data.keyword;
      if (keyword) {
        await triggerAnalysis(dbJobId, keyword);
        logger.info(`분석 파이프라인 트리거됨: job=${dbJobId}, keyword=${keyword}`);
      }

      return { persisted: true };
    }
  };
}
