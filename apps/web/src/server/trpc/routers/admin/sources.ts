import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, desc } from 'drizzle-orm';
import { dataSources } from '@ai-signalcraft/core';
import {
  buildDynamicCollector,
  type DataSourceSnapshot,
  type HtmlSelectors,
} from '@ai-signalcraft/collectors';
import { protectedProcedure, systemAdminProcedure, router } from '../../init';

// 어댑터별 config 검증 — discriminated union
const HtmlSelectorsSchema = z.object({
  item: z.string().min(1),
  title: z.string().min(1),
  link: z.string().min(1),
  body: z.string().optional(),
  date: z.string().optional(),
});

const ConfigSchema = z
  .object({
    selectors: HtmlSelectorsSchema.optional(),
  })
  .nullable()
  .optional();

const adapterTypeSchema = z.enum(['rss', 'html']);

function validateUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `유효하지 않은 URL: ${url}`,
    });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `허용되지 않은 프로토콜: ${parsed.protocol}`,
    });
  }
}

export const sourcesRouter = router({
  // 관리자 페이지 — 모든 소스 (enabled/disabled 포함)
  list: systemAdminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(dataSources).orderBy(desc(dataSources.createdAt));
  }),

  // 대시보드 트리거 폼 — 활성 소스만, 일반 사용자 접근 가능
  listEnabled: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: dataSources.id,
        name: dataSources.name,
        adapterType: dataSources.adapterType,
        defaultLimit: dataSources.defaultLimit,
      })
      .from(dataSources)
      .where(eq(dataSources.enabled, true))
      .orderBy(desc(dataSources.createdAt));
  }),

  create: systemAdminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        adapterType: adapterTypeSchema,
        url: z.string().min(1),
        config: ConfigSchema,
        defaultLimit: z.number().int().min(1).max(500).default(50),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      validateUrl(input.url);
      // HTML은 selectors 필수
      if (input.adapterType === 'html') {
        if (!input.config?.selectors) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'HTML 어댑터는 config.selectors가 필요합니다.',
          });
        }
      }
      const [row] = await ctx.db
        .insert(dataSources)
        .values({
          name: input.name,
          adapterType: input.adapterType,
          url: input.url,
          config: (input.config ?? null) as Record<string, unknown> | null,
          defaultLimit: input.defaultLimit,
          createdBy: ctx.session.user.id,
        })
        .returning();
      return row;
    }),

  update: systemAdminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(200).optional(),
        url: z.string().min(1).optional(),
        config: ConfigSchema,
        defaultLimit: z.number().int().min(1).max(500).optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (input.url) validateUrl(input.url);
      const patch: Partial<typeof dataSources.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.name !== undefined) patch.name = input.name;
      if (input.url !== undefined) patch.url = input.url;
      if (input.config !== undefined) {
        patch.config = (input.config ?? null) as Record<string, unknown> | null;
      }
      if (input.defaultLimit !== undefined) patch.defaultLimit = input.defaultLimit;
      if (input.enabled !== undefined) patch.enabled = input.enabled;

      const [row] = await ctx.db
        .update(dataSources)
        .set(patch)
        .where(eq(dataSources.id, input.id))
        .returning();
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '소스를 찾을 수 없습니다.' });
      }
      return row;
    }),

  delete: systemAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // soft delete: enabled=false. 기존 articles.dataSourceId FK는 보존.
      const [row] = await ctx.db
        .update(dataSources)
        .set({ enabled: false, updatedAt: new Date() })
        .where(eq(dataSources.id, input.id))
        .returning();
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '소스를 찾을 수 없습니다.' });
      }
      return { ok: true };
    }),

  // 저장 전 테스트 수집 — DB에 저장하지 않고 샘플 5건만 반환
  test: systemAdminProcedure
    .input(
      z.object({
        adapterType: adapterTypeSchema,
        url: z.string().min(1),
        config: ConfigSchema,
      }),
    )
    .mutation(async ({ input }) => {
      validateUrl(input.url);
      const snapshot: DataSourceSnapshot = {
        id: 'test-preview',
        name: '[테스트]',
        adapterType: input.adapterType,
        url: input.url,
        config: (input.config ?? null) as Record<string, unknown> | null,
        defaultLimit: 5,
      };
      try {
        const collector = buildDynamicCollector(snapshot);
        const samples: unknown[] = [];
        for await (const chunk of collector.collect({
          keyword: 'preview',
          startDate: new Date(Date.now() - 7 * 86400 * 1000).toISOString(),
          endDate: new Date().toISOString(),
          maxItems: 5,
        })) {
          samples.push(...chunk);
          if (samples.length >= 5) break;
        }
        return {
          ok: true as const,
          count: samples.length,
          items: samples.slice(0, 5),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false as const, error: message, count: 0, items: [] };
      }
    }),

  // URL 패턴으로 adapterType 추론
  detectType: systemAdminProcedure
    .input(z.object({ url: z.string().min(1) }))
    .mutation(({ input }) => {
      try {
        const parsed = new URL(input.url);
        const pathname = parsed.pathname.toLowerCase();
        if (
          pathname.endsWith('.rss') ||
          pathname.endsWith('.xml') ||
          pathname.endsWith('/feed') ||
          pathname.endsWith('/rss') ||
          pathname.includes('/rss/') ||
          pathname.includes('/feed/')
        ) {
          return { adapterType: 'rss' as const };
        }
        return { adapterType: 'html' as const };
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '유효하지 않은 URL' });
      }
    }),
});

// 타입 확인용 (빌드 시점 검증)
export type _SourcesHtmlSelectors = HtmlSelectors;
