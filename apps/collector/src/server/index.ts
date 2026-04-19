import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import type { TRPCError } from '@trpc/server';
import { appRouter } from './trpc/router';
import { createCollectorContext } from './trpc/init';

const PORT = Number(process.env.PORT ?? 3400);
const HOST = process.env.HOST ?? '0.0.0.0';

async function main() {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
    maxParamLength: 5000,
  });

  await server.register(cors, {
    origin: true,
    credentials: true,
  });

  await server.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext: createCollectorContext,
      onError({ error, path }: { error: TRPCError; path: string | undefined }) {
        server.log.error({ path, code: error.code, msg: error.message }, 'trpc error');
      },
    },
  });

  server.get('/health', async () => ({
    status: 'ok',
    service: 'ai-signalcraft-collector',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }));

  try {
    await server.listen({ port: PORT, host: HOST });
    server.log.info(`collector service ready on http://${HOST}:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[collector] startup failed:', err);
  process.exit(1);
});
