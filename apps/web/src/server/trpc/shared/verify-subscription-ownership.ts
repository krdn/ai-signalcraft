import { TRPCError } from '@trpc/server';
import { getCollectorClient } from '@ai-signalcraft/core';

// 구독 소유권 확인 헬퍼 — collector 서비스에서 구독을 조회해 ownerId 검증
export async function verifySubscriptionOwnership(ctx: { userId: string }, subscriptionId: number) {
  const res = await getCollectorClient().subscriptions.get.query({ id: subscriptionId });
  const sub = res as { ownerId?: string | null } | null;
  if (!sub) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '구독을 찾을 수 없습니다' });
  }
  if (sub.ownerId && sub.ownerId !== ctx.userId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '이 구독에 대한 접근 권한이 없습니다' });
  }
}
