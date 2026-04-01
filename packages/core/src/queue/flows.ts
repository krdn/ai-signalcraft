import { FlowProducer } from 'bullmq';
import type { CollectionTrigger } from '../types';
import type { ResumeOptions } from '../analysis/pipeline-orchestrator';
import { getRedisConnection } from './connection';

// FlowProducer를 lazy 초기화 -- import 시 Redis 연결 시도 방지
let flowProducer: FlowProducer | null = null;

function getFlowProducer() {
  if (!flowProducer) {
    flowProducer = new FlowProducer({ connection: getRedisConnection() });
  }
  return flowProducer;
}

// dbJobId: collection_jobs 테이블의 정수 PK -- 호출자가 createCollectionJob() 후 전달
export async function triggerCollection(params: CollectionTrigger, dbJobId: number) {
  const flowId = `collection-${Date.now()}`;
  const limits = params.limits ?? {
    naverArticles: 1000,
    youtubeVideos: 50,
    communityPosts: 50,
    commentsPerItem: 500,
  };

  // D-05: 3단계 분리 -- collect -> normalize -> persist
  // D-01: 통합 키워드 수집 -- 모든 소스 동시 실행
  // D-04: 부분 실패 허용 -- 소스별 독립 실행
  // INT-01: sources 필드 기반 조건부 수집기 실행
  const enabledSources = params.sources ?? ['naver', 'youtube', 'dcinside', 'fmkorea', 'clien'];

  const children = [];
  if (enabledSources.includes('naver')) {
    children.push({
      name: 'normalize-naver',
      queueName: 'pipeline',
      data: { source: 'naver-news', flowId, dbJobId, maxComments: limits.commentsPerItem },
      children: [
        {
          name: 'collect-naver-articles',
          queueName: 'collectors',
          data: {
            ...params,
            source: 'naver-news',
            maxItems: limits.naverArticles,
            maxComments: limits.commentsPerItem,
            flowId,
            dbJobId,
          },
        },
      ],
    });
  }
  if (enabledSources.includes('youtube')) {
    children.push({
      name: 'normalize-youtube',
      queueName: 'pipeline',
      data: {
        source: 'youtube',
        flowId,
        dbJobId,
        maxComments: limits.commentsPerItem,
        startDate: params.startDate,
        endDate: params.endDate,
      },
      children: [
        {
          name: 'collect-youtube-videos',
          queueName: 'collectors',
          data: {
            ...params,
            source: 'youtube-videos',
            maxItems: limits.youtubeVideos,
            flowId,
            dbJobId,
          },
        },
      ],
    });
  }
  // 커뮤니티 수집기 -- 각 소스별 독립 실행 (부분 실패 허용)
  if (enabledSources.includes('dcinside')) {
    children.push({
      name: 'normalize-community-dcinside',
      queueName: 'pipeline',
      data: { source: 'dcinside', flowId, dbJobId },
      children: [
        {
          name: 'collect-dcinside',
          queueName: 'collectors',
          data: {
            ...params,
            source: 'dcinside',
            maxItems: limits.communityPosts,
            maxComments: limits.commentsPerItem,
            flowId,
            dbJobId,
          },
        },
      ],
    });
  }
  if (enabledSources.includes('fmkorea')) {
    children.push({
      name: 'normalize-community-fmkorea',
      queueName: 'pipeline',
      data: { source: 'fmkorea', flowId, dbJobId },
      children: [
        {
          name: 'collect-fmkorea',
          queueName: 'collectors',
          data: {
            ...params,
            source: 'fmkorea',
            maxItems: limits.communityPosts,
            maxComments: limits.commentsPerItem,
            flowId,
            dbJobId,
          },
        },
      ],
    });
  }
  if (enabledSources.includes('clien')) {
    children.push({
      name: 'normalize-community-clien',
      queueName: 'pipeline',
      data: { source: 'clien', flowId, dbJobId },
      children: [
        {
          name: 'collect-clien',
          queueName: 'collectors',
          data: {
            ...params,
            source: 'clien',
            maxItems: limits.communityPosts,
            maxComments: limits.commentsPerItem,
            flowId,
            dbJobId,
          },
        },
      ],
    });
  }

  const flow = await getFlowProducer().add({
    name: 'persist',
    queueName: 'pipeline',
    data: { flowId, dbJobId, keyword: params.keyword },
    opts: {
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
    },
    children,
  });

  return { flowId, dbJobId, flow };
}

// D-09: 분석 파이프라인 트리거 -- persist 완료 후 호출
// runner.ts가 내부적으로 3단계 병렬/순차를 관리하므로 Flow는 단일 작업으로 단순화
export async function triggerAnalysis(dbJobId: number, keyword: string) {
  const flow = await getFlowProducer().add({
    name: 'run-analysis',
    queueName: 'analysis',
    data: { dbJobId, keyword },
    opts: {
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
    },
  });
  return flow;
}

// 분석 재실행 트리거 -- 완료된 모듈은 DB에서 로드하고 실패/미실행 모듈만 재실행
export async function triggerAnalysisResume(
  dbJobId: number,
  keyword: string,
  resumeOptions: ResumeOptions,
) {
  const flow = await getFlowProducer().add({
    name: 'run-analysis',
    queueName: 'analysis',
    data: { dbJobId, keyword, resumeOptions },
    opts: {
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
    },
  });
  return flow;
}
