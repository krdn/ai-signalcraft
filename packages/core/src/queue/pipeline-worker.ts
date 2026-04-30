// 파이프라인 Worker 핸들러 -- pipeline 큐 (normalize + persist)
import type { Job } from 'bullmq';
import type { DataSourceSnapshot } from '@ai-signalcraft/collectors';
import { isPipelineCancelled } from '../pipeline/control';
import { createLogger } from '../utils/logger';
import { handleClassify } from './pipeline-worker-classify';
import { handlePersist } from './pipeline-worker-persist';
import { collectNaverCommentsForArticles } from './pipeline-worker-naver';
import { splitYoutubeUnifiedResult, collectYoutubeCommentsLegacy } from './pipeline-worker-youtube';

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
        await collectNaverCommentsForArticles(job, results);
      }

      // normalize-youtube: 일체형(신규) 또는 레거시 YoutubeVideosCollector 결과 처리
      if (job.name === 'normalize-youtube') {
        const unifiedHandled = await splitYoutubeUnifiedResult(job, results);
        if (!unifiedHandled) {
          await collectYoutubeCommentsLegacy(job, results);
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
