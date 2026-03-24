import { FlowProducer } from 'bullmq';
import { redisConnection } from './connection';
import type { CollectionTrigger } from '../types';

// FlowProducer를 lazy 초기화 -- import 시 Redis 연결 시도 방지
let flowProducer: FlowProducer | null = null;

function getFlowProducer() {
  if (!flowProducer) {
    flowProducer = new FlowProducer({ connection: redisConnection });
  }
  return flowProducer;
}

// dbJobId: collection_jobs 테이블의 정수 PK -- 호출자가 createCollectionJob() 후 전달
export async function triggerCollection(params: CollectionTrigger, dbJobId: number) {
  const flowId = `collection-${Date.now()}`;
  const limits = params.limits ?? {
    naverArticles: 100,
    youtubeVideos: 50,
    commentsPerItem: 500,
  };

  // D-05: 3단계 분리 -- collect -> normalize -> persist
  // D-01: 통합 키워드 수집 -- 모든 소스 동시 실행
  // D-04: 부분 실패 허용 -- 소스별 독립 실행
  const flow = await getFlowProducer().add({
    name: 'persist',
    queueName: 'pipeline',
    data: { flowId, dbJobId, keyword: params.keyword },
    children: [
      {
        name: 'normalize-naver',
        queueName: 'pipeline',
        data: { source: 'naver-news', flowId, dbJobId, maxComments: limits.commentsPerItem },
        children: [
          {
            name: 'collect-naver-articles',
            queueName: 'collectors',
            data: { ...params, source: 'naver-news', maxItems: limits.naverArticles, maxComments: limits.commentsPerItem, flowId, dbJobId },
          },
        ],
      },
      {
        name: 'normalize-youtube',
        queueName: 'pipeline',
        data: { source: 'youtube', flowId, dbJobId },
        children: [
          {
            name: 'collect-youtube-videos',
            queueName: 'collectors',
            data: { ...params, source: 'youtube-videos', maxItems: limits.youtubeVideos, flowId, dbJobId },
          },
          {
            name: 'collect-youtube-comments',
            queueName: 'collectors',
            data: { ...params, source: 'youtube-comments', maxComments: limits.commentsPerItem, flowId, dbJobId },
          },
        ],
      },
    ],
  });

  return { flowId, dbJobId, flow };
}
