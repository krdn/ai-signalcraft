// packages/core 단위 테스트용 공통 헬퍼.
//
// 분석/큐 관련 테스트가 자주 모킹하는 외부 시스템:
//   - DB (drizzle select chain)
//   - BullMQ Queue/Worker
//   - Redis 연결
//
// 통합 테스트 인프라(testcontainers 등)는 별도 spec.
// 본 모듈은 빠른 단위 테스트용 stub만 제공.

import { vi } from 'vitest';

/**
 * Drizzle select chain mock 빌더.
 *
 * 사용:
 *   const select = mockDbSelect([{ id: 1, status: 'completed' }]);
 *   vi.mock('../db', () => ({ getDb: () => ({ select }) }));
 */
export function mockDbSelect<T>(rows: T[]) {
  const chain: Record<string, unknown> = {};
  const passthrough = () => chain;
  for (const method of [
    'from',
    'where',
    'limit',
    'orderBy',
    'groupBy',
    'innerJoin',
    'leftJoin',
    'rightJoin',
    'fullJoin',
    'as',
    'set',
    'returning',
  ]) {
    chain[method] = passthrough;
  }
  chain.then = (resolve: (v: T[]) => unknown, reject?: (e: unknown) => unknown) => {
    try {
      return Promise.resolve(rows).then(resolve, reject);
    } catch (e) {
      return reject ? reject(e) : Promise.reject(e);
    }
  };
  return () => chain;
}

/**
 * BullMQ Queue/Worker 모킹용 stub factory.
 *
 * import { mockBullMQ } from '../__tests__/test-helpers';
 * mockBullMQ();
 */
export function mockBullMQ(): {
  add: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
} {
  const add = vi.fn().mockResolvedValue({ id: 'mock-job-1' });
  const remove = vi.fn().mockResolvedValue(undefined);
  const close = vi.fn().mockResolvedValue(undefined);

  vi.mock('bullmq', () => ({
    Queue: vi.fn().mockImplementation(() => ({
      add,
      remove,
      close,
      getJobs: vi.fn().mockResolvedValue([]),
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
    })),
    Worker: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      close,
    })),
    FlowProducer: vi.fn().mockImplementation(() => ({
      add: vi.fn().mockResolvedValue({ job: { id: 'mock-flow-1' } }),
      close,
    })),
  }));

  return { add, remove, close };
}
