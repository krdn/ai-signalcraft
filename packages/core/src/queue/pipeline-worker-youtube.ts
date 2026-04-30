// normalize-youtube: 일체형 YoutubeCollector 결과 + 레거시 YoutubeVideosCollector 댓글 수집
import type { Job } from 'bullmq';
import { YoutubeCommentsCollector } from '@ai-signalcraft/collectors';
import type { YoutubeComment, YoutubeVideo } from '@ai-signalcraft/collectors';
import { updateJobProgress } from '../pipeline';
import { isPipelineCancelled } from '../pipeline/control';
import { createLogger } from '../utils/logger';

const logger = createLogger('pipeline-worker');

const YT_CONCURRENCY = 3;

/** 신규 경로: YoutubeCollector(일체형)이 영상+댓글을 함께 수집한 결과 분리 */
export async function splitYoutubeUnifiedResult(
  job: Job,
  results: Record<string, unknown>,
): Promise<boolean> {
  const { dbJobId } = job.data;
  if (!results['youtube']) return false;

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

  return true;
}

/** 레거시 경로: YoutubeVideosCollector 결과에 댓글 후처리 (semaphore=3, since 주입 불필요) */
export async function collectYoutubeCommentsLegacy(
  job: Job,
  results: Record<string, unknown>,
): Promise<void> {
  const { dbJobId } = job.data;
  if (!results['youtube-videos'] || results['youtube']) return;

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
      logger.info(`[normalize-youtube] 댓글 수집 중 취소됨 (${allComments.length}건 수집 후)`);
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
