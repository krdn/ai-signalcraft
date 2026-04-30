// normalize-* 진입점 — 자식(collect) 결과 수집 + naver/youtube/feed/community 위임
import type { Job } from 'bullmq';
import type { DataSourceSnapshot } from '@ai-signalcraft/collectors';
import { isPipelineCancelled } from '../pipeline/control';
import { createLogger } from '../utils/logger';
import { collectNaverCommentsForArticles } from './pipeline-worker-naver';
import { splitYoutubeUnifiedResult, collectYoutubeCommentsLegacy } from './pipeline-worker-youtube';

const logger = createLogger('pipeline-worker');

export async function handleNormalize(job: Job, jobStartTime: number): Promise<unknown> {
  const { source, dbJobId } = job.data;

  // 취소 확인
  if (dbJobId && (await isPipelineCancelled(dbJobId))) {
    logger.info(`[${job.name}] 취소됨 — 정규화 건너뜀`);
    return { skipped: true, reason: 'cancelled' };
  }

  // 자식 작업(collect) 결과 수집
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
    await collectNaverCommentsForArticles(job, results);
  }

  // normalize-youtube: 일체형(신규) 또는 레거시 YoutubeVideosCollector 결과 처리
  if (job.name === 'normalize-youtube') {
    const unifiedHandled = await splitYoutubeUnifiedResult(job, results);
    if (!unifiedHandled) {
      await collectYoutubeCommentsLegacy(job, results);
    }
  }

  // normalize-community: 커뮤니티 수집기는 게시글+댓글 통합 수집 → 추가 작업 없음
  // results에 각 커뮤니티 소스 결과가 그대로 담김

  const normalizeElapsed = ((Date.now() - jobStartTime) / 1000).toFixed(1);
  logger.info(`[${job.name}] 완료: ${normalizeElapsed}초 소요`);
  return { source, dbJobId, normalized: true, results };
}
