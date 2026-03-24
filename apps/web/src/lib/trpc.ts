import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@/server/trpc/router';

// tRPC 바닐라 클라이언트 (서버 컴포넌트 등에서 직접 호출용)
export const trpcClient = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: '/api/trpc' })],
});
