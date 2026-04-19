import { createTRPCClient, httpBatchLink, type TRPCClient } from '@trpc/client';
import type { AppRouter } from '@ai-signalcraft/collector/router';

/**
 * collector 서비스 호출 전용 tRPC 클라이언트.
 *
 * 의존성: apps/collector의 router 타입만 import (런타임 0).
 * 실제 호출은 COLLECTOR_URL/${COLLECTOR_API_KEY}로 HTTP 수행.
 */

export type CollectorClient = TRPCClient<AppRouter>;

function getCollectorUrl(): string {
  const url = process.env.COLLECTOR_URL;
  if (!url) {
    throw new Error('COLLECTOR_URL 환경변수가 설정되지 않았습니다. (예: http://localhost:3400)');
  }
  return url.replace(/\/+$/, '');
}

function getCollectorApiKey(): string {
  const key = process.env.COLLECTOR_API_KEY;
  if (!key) {
    throw new Error('COLLECTOR_API_KEY 환경변수가 설정되지 않았습니다.');
  }
  return key;
}

export function createCollectorClient(): CollectorClient {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${getCollectorUrl()}/trpc`,
        headers: () => ({
          Authorization: `Bearer ${getCollectorApiKey()}`,
        }),
      }),
    ],
  });
}

let _cached: CollectorClient | null = null;

/**
 * 프로세스 전역 singleton — ai-signalcraft 서버/워커에서 재사용.
 */
export function getCollectorClient(): CollectorClient {
  if (!_cached) _cached = createCollectorClient();
  return _cached;
}
