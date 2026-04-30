// persist 핸들러 — 정규화 결과 DB 영속화 + 임베딩 + 후속 트리거
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import type { CommunityPost, DataSourceSnapshot } from '@ai-signalcraft/collectors';
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
  linkArticleKeywords,
  linkVideoKeywords,
} from '../pipeline';
import { isPipelineCancelled } from '../pipeline/control';
import { awaitStageGate } from '../pipeline/pipeline-checks';
import { getDb } from '../db';
import { dataSources } from '../db/schema/sources';
import {
  persistArticleEmbeddings,
  persistCommentEmbeddings,
} from '../analysis/preprocessing/embedding-persist';
import { createLogger } from '../utils/logger';
import { triggerClassify } from './flows';
import { enqueueWhisperForTopVideos } from './whisper-enqueue';
import { COMMUNITY_SOURCES } from './worker-config';

const logger = createLogger('pipeline-worker');

export async function handlePersist(job: Job, jobStartTime: number): Promise<unknown> {
  const { dbJobId } = job.data;

  // 취소 확인
  if (dbJobId && (await isPipelineCancelled(dbJobId))) {
    logger.info(`[persist] 취소됨 — 저장 건너뜀`);
    return { skipped: true, reason: 'cancelled' };
  }

  // BP 게이트: 수집 완료 후 (모든 children 완료 후 persist 진입 전)
  if (dbJobId && !(await awaitStageGate(dbJobId, 'collection'))) {
    return { cancelled: true };
  }

  // TTL 재사용을 위해 신규 수집된 기사/영상 id 를 keyword 에 인덱싱
  // (다음 실행에서 재사용 후보로 식별되도록)
  const keywordForLink = job.data.keyword as string | undefined;
  const newArticleIds: number[] = [];
  const newVideoIds: number[] = [];

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
        newArticleIds.push(row.id);
      }
    }

    // Step 2: 영상 persist -> sourceId->dbId 매핑 생성
    if (results['youtube-videos']) {
      const videoItems = (results['youtube-videos'] as any).items || [];
      const normalized = videoItems.map((v: any) => normalizeYoutubeVideo(v));
      const persisted = await persistVideos(jobIdForDb, normalized);
      for (const row of persisted) {
        videoSourceToDbId.set(row.sourceId, row.id);
        newVideoIds.push(row.id);
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
        newArticleIds.push(row.id);
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
        const persisted = await persistArticles(jobIdForDb, normalized);
        for (const row of persisted) newArticleIds.push(row.id);
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

  // TTL 재사용 인덱스 갱신 — 신규 수집된 기사/영상을 keyword 에 연결
  // 다음 실행에서 재사용 후보로 즉시 식별됨. 실패해도 파이프라인은 계속.
  if (keywordForLink) {
    try {
      await Promise.all([
        linkArticleKeywords(newArticleIds, keywordForLink),
        linkVideoKeywords(newVideoIds, keywordForLink),
      ]);
    } catch (err) {
      logger.warn('[persist] keyword linkage 실패:', err);
    }
  }

  // Whisper 전사 큐 push — YouTube 영상이 이번 job에 있고 자막이 아직 없는 것 중
  // 조회수 상위 N개. whisper-worker 컨테이너가 yt-dlp로 오디오 다운로드 후
  // faster-whisper로 전사해 videos.transcript를 UPDATE한다.
  // 분석은 기다리지 않음 — 다음 실행부터 혜택을 받는 eventual-consistency 방식.
  // dbJobId가 없으면(레거시 경로) 스킵 — enqueueWhisperForTopVideos는 jobId 기반 쿼리
  if (newVideoIds.length > 0 && dbJobId) {
    try {
      // Top-N 100 — whisper-worker가 영상 길이 기반 세그먼트 전략(앞5분/앞5+뒤2/전체)으로
      // 처리 비용을 제어하므로 후보를 넓게 줘도 안전. runaway 방지용 상한.
      const { enqueued } = await enqueueWhisperForTopVideos({
        jobId: dbJobId,
        topN: 100,
      });
      if (enqueued > 0) {
        logger.info(`[whisper] ${enqueued}개 영상 전사 큐에 등록 (dbJobId=${dbJobId})`);
      }
    } catch (err) {
      // Whisper enqueue 실패는 파이프라인을 막지 않음 — 분석은 description 폴백으로 진행
      logger.warn('[whisper] enqueue 실패:', err instanceof Error ? err.message : err);
    }
  }

  // 임베딩 생성 — 분석 트리거 전에 완료해야 RAG가 올바르게 동작
  // 실패해도 분석은 진행 (RAG fallback이 처리)
  try {
    const db = getDb();
    const { articleJobs, commentJobs } = await import('../db/schema/collections');
    const articleRows = await db
      .select({ articleId: articleJobs.articleId })
      .from(articleJobs)
      .where(eq(articleJobs.jobId, dbJobId));
    const commentRows = await db
      .select({ commentId: commentJobs.commentId })
      .from(commentJobs)
      .where(eq(commentJobs.jobId, dbJobId));

    const articleIds = articleRows.map((r) => r.articleId);
    const commentIds = commentRows.map((r) => r.commentId);

    // 분석 트리거 전에 임베딩 완료를 기다림 (race condition 방지)
    await Promise.allSettled([
      articleIds.length > 0 ? persistArticleEmbeddings(articleIds) : Promise.resolve(),
      commentIds.length > 0 ? persistCommentEmbeddings(commentIds) : Promise.resolve(),
    ]);
    logger.info(
      `[persist] 임베딩 생성 완료 (기사=${articleIds.length}, 댓글=${commentIds.length})`,
    );
  } catch (err) {
    logger.warn(`[persist] 임베딩 생성 스킵:`, err);
  }

  // D-06: 최종 상태 업데이트 -- dbJobId는 number이므로 parseInt 불필요
  await updateJobProgress(dbJobId, {}, 'completed');

  const persistElapsed = ((Date.now() - jobStartTime) / 1000).toFixed(1);
  logger.info(`[persist] 완료: ${persistElapsed}초 소요 (dbJobId=${dbJobId})`);

  // D-09: 수집 완료 후 자동 분석 트리거
  // 취소 확인 — persist 완료 후에도 취소되었으면 분류/분석 트리거하지 않음
  const keyword = job.data.keyword;
  if (keyword) {
    if (dbJobId && (await isPipelineCancelled(dbJobId))) {
      logger.info(`[persist] 취소됨 — classify 트리거 건너뜀 (dbJobId=${dbJobId})`);
    } else {
      // classify 노드가 내부적으로 게이트 확인 후 triggerAnalysis 호출
      await triggerClassify(dbJobId, keyword);
      logger.info(`classify 노드 트리거됨: job=${dbJobId}, keyword=${keyword}`);
    }
  }

  return { persisted: true };
}
