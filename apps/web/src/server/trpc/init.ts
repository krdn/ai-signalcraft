import { initTRPC, TRPCError } from '@trpc/server';
import { auth } from '../auth';
import { db } from '@ai-signalcraft/core';

export const createTRPCContext = async () => {
  const session = await auth();
  return { session, db };
};

const t = initTRPC
  .context<Awaited<ReturnType<typeof createTRPCContext>>>()
  .create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, session: ctx.session } });
});
