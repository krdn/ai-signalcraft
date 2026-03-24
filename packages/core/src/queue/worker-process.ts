// BullMQ Worker 실행 프로세스 -- Next.js와 별도 프로세스로 실행
// 실행: pnpm --filter @ai-signalcraft/core worker 또는 tsx watch src/queue/worker-process.ts
import 'dotenv/config';
import { Job } from 'bullmq';
import { createCollectorWorker, createPipelineWorker } from './workers';
import {
  NaverNewsCollector,
  NaverCommentsCollector,
  YoutubeVideosCollector,
  YoutubeCommentsCollector,
  registerCollector,
  getCollector,
} from '@ai-signalcraft/collectors';
import {
  normalizeNaverArticle,
  normalizeNaverComment,
  normalizeYoutubeVideo,
  normalizeYoutubeComment,
  persistArticles,
  persistVideos,
  persistComments,
  updateJobProgress,
} from '../pipeline';

// 수집기 등록
registerCollector(new NaverNewsCollector());
registerCollector(new NaverCommentsCollector());
registerCollector(new YoutubeVideosCollector());
registerCollector(new YoutubeCommentsCollector());

// 수집 Worker -- collectors 큐
const collectorWorker = createCollectorWorker(async (job: Job) => {
  const { source, keyword, startDate, endDate, maxItems, maxComments } = job.data;
  const collector = getCollector(source);
  if (!collector) throw new Error(`Unknown source: ${source}`);

  const allItems: unknown[] = [];
  for await (const chunk of collector.collect({ keyword, startDate, endDate, maxItems, maxComments })) {
    allItems.push(...chunk);
    // D-06: 진행률 업데이트
    await job.updateProgress({ collected: allItems.length });
  }

  return { source, items: allItems, count: allItems.length };
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
    }

    // D-06: 최종 상태 업데이트 -- dbJobId는 number이므로 parseInt 불필요
    await updateJobProgress(dbJobId, {}, 'completed');
    return { persisted: true };
  }
});

console.log('Workers started. Waiting for jobs...');
console.log('  - Collector worker (collectors queue)');
console.log('  - Pipeline worker (pipeline queue)');

// Graceful shutdown
process.on('SIGTERM', async () => {
  await collectorWorker.close();
  await pipelineWorker.close();
  process.exit(0);
});
