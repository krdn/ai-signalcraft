// BullMQ Worker 실행 프로세스 -- Next.js와 별도 프로세스로 실행
// 실행: pnpm worker (루트) 또는 pnpm --filter @ai-signalcraft/core worker
import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// 모노리포 루트 탐색 -- pnpm-workspace.yaml이 있는 디렉토리
function findMonorepoRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return startDir; // 폴백: 시작 디렉토리
}

const root = findMonorepoRoot(process.cwd());

// dotenv 로드: apps/web/.env.local이 시스템 환경변수보다 우선
// override: true -> .env.local 값이 시스템 환경변수를 덮어씀
config({ path: resolve(root, 'apps/web/.env.local'), override: true });
config({ path: resolve(root, '.env') });
import { Job, Worker } from 'bullmq';
import { createCollectorWorker, createPipelineWorker } from './workers';
import { getRedisConnection } from './connection';
import { triggerAnalysis } from './flows';
import {
  NaverNewsCollector,
  NaverCommentsCollector,
  YoutubeVideosCollector,
  YoutubeCommentsCollector,
  DCInsideCollector,
  FMKoreaCollector,
  ClienCollector,
  registerCollector,
  getCollector,
} from '@ai-signalcraft/collectors';
import type { NaverComment, YoutubeComment, CommunityPost } from '@ai-signalcraft/collectors';
import {
  normalizeNaverArticle,
  normalizeNaverComment,
  normalizeYoutubeVideo,
  normalizeYoutubeComment,
  normalizeCommunityPost,
  normalizeCommunityComment,
  persistArticles,
  persistVideos,
  persistComments,
  updateJobProgress,
} from '../pipeline';
import type { CommunitySource } from '../pipeline/normalize';
import { runAnalysisPipeline } from '../analysis/runner';

// AI API 키 검증 -- 분석 파이프라인에 필수
const requiredApiKeys = [
  { name: 'OPENAI_API_KEY', prefix: 'sk-', usage: 'Stage 1 분석 (gpt-4o-mini)' },
  { name: 'ANTHROPIC_API_KEY', prefix: 'sk-ant-', usage: 'Stage 2~3 분석 + 리포트 생성 (Claude)' },
];
for (const key of requiredApiKeys) {
  const value = process.env[key.name];
  if (!value) {
    console.warn(`[WARNING] ${key.name} 미설정 -- ${key.usage} 실패 예상. apps/web/.env.local에 추가하세요.`);
  } else if (key.prefix && !value.startsWith(key.prefix)) {
    console.warn(`[WARNING] ${key.name} 형식 의심 (${key.prefix}로 시작하지 않음) -- ${key.usage} 실패 가능`);
  }
}

// 수집기 등록
registerCollector(new NaverNewsCollector());
registerCollector(new NaverCommentsCollector());
registerCollector(new YoutubeVideosCollector());
registerCollector(new YoutubeCommentsCollector());
registerCollector(new DCInsideCollector());
registerCollector(new FMKoreaCollector());
registerCollector(new ClienCollector());

// 커뮤니티 소스 목록 (normalize/persist에서 공통 처리)
const COMMUNITY_SOURCES: CommunitySource[] = ['dcinside', 'fmkorea', 'clien'];

// 소스별 수집 건수 카운트 유틸리티
function countBySourceType(source: string, items: unknown[]): Record<string, number> {
  const count = items.length;
  // 소스에 따라 articles/videos/posts 필드 매핑
  if (source === 'naver-news') return { articles: count, comments: 0 };
  if (source === 'youtube-videos') return { videos: count, comments: 0 };
  if (source === 'youtube-comments') return { comments: count };
  // 커뮤니티 소스: 게시글 수 + 내장 댓글 수
  const posts = count;
  const commentCount = items.reduce<number>((sum, item: any) => sum + (item?.comments?.length ?? 0), 0);
  return { posts, comments: commentCount };
}

// progress JSONB 키 매핑 (소스명 → progress 키)
function progressKey(source: string): string {
  if (source === 'naver-news') return 'naver';
  if (source === 'youtube-videos' || source === 'youtube-comments') return 'youtube';
  return source; // dcinside, fmkorea, clien
}

// 수집 Worker -- collectors 큐
// D-04: 부분 실패 허용 -- 개별 소스 실패 시 빈 결과 반환 (파이프라인 중단 방지)
const collectorWorker = createCollectorWorker(async (job: Job) => {
  const { source, keyword, startDate, endDate, maxItems, maxComments, dbJobId } = job.data;
  const collector = getCollector(source);
  if (!collector) throw new Error(`Unknown source: ${source}`);

  const pKey = progressKey(source);

  try {
    // DB: 수집 시작 상태
    if (dbJobId) {
      await updateJobProgress(dbJobId, {
        [pKey]: { status: 'running', ...countBySourceType(source, []) }
      }, 'running');
    }

    const allItems: unknown[] = [];
    for await (const chunk of collector.collect({ keyword, startDate, endDate, maxItems, maxComments })) {
      allItems.push(...chunk);
      await job.updateProgress({ collected: allItems.length });
      // DB: 실시간 진행 업데이트
      if (dbJobId) {
        await updateJobProgress(dbJobId, {
          [pKey]: { status: 'running', ...countBySourceType(source, allItems) }
        });
      }
    }

    // DB: 수집 완료
    if (dbJobId) {
      await updateJobProgress(dbJobId, {
        [pKey]: { status: 'completed', ...countBySourceType(source, allItems) }
      });
    }

    return { source, items: allItems, count: allItems.length };
  } catch (err) {
    console.warn(`[${source}] 수집 실패 (부분 실패 허용):`, err instanceof Error ? err.message : err);
    // DB: 수집 실패
    if (dbJobId) {
      await updateJobProgress(dbJobId, {
        [pKey]: { status: 'failed', ...countBySourceType(source, []) }
      });
    }
    return { source, items: [], count: 0 };
  }
});

// 파이프라인 Worker -- pipeline 큐 (normalize + persist)
const pipelineWorker = createPipelineWorker(async (job: Job) => {
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
          console.warn(`댓글 수집 실패 (${article.url}):`, err);
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
          console.warn(`[youtube-comments] 영상 댓글 수집 실패 (${video.sourceId}):`, err instanceof Error ? err.message : err);
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
      // results에 각 커뮤니티 소스 결과가 담겨 있음
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
      // 커뮤니티 수집기는 게시글에 댓글이 포함되어 있으므로 게시글 persist 후 댓글 처리
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
    }

    // D-06: 최종 상태 업데이트 -- dbJobId는 number이므로 parseInt 불필요
    await updateJobProgress(dbJobId, {}, 'completed');

    // D-09: 수집 완료 후 자동 분석 트리거
    const keyword = job.data.keyword;
    if (keyword) {
      await triggerAnalysis(dbJobId, keyword);
      console.log(`분석 파이프라인 트리거됨: job=${dbJobId}, keyword=${keyword}`);
    }

    return { persisted: true };
  }
});

// 분석 Worker -- analysis 큐
const analysisWorker = new Worker('analysis', async (job: Job) => {
  const { dbJobId, keyword } = job.data;

  if (job.name === 'run-analysis') {
    console.log(`분석 시작: job=${dbJobId}, keyword=${keyword}`);
    const result = await runAnalysisPipeline(dbJobId);

    await job.updateProgress({
      completedModules: result.completedModules,
      failedModules: result.failedModules,
    });

    console.log(`분석 완료: completed=${result.completedModules.length}, failed=${result.failedModules.length}`);
    return result;
  }
}, { connection: getRedisConnection() });

console.log('Workers started. Waiting for jobs...');
console.log('  - Collector worker (collectors queue)');
console.log('  - Pipeline worker (pipeline queue)');
console.log('  - Analysis worker (analysis queue)');

// Graceful shutdown
process.on('SIGTERM', async () => {
  await collectorWorker.close();
  await pipelineWorker.close();
  await analysisWorker.close();
  process.exit(0);
});
