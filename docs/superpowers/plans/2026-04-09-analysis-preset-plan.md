# Analysis Preset (Keyword Type) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 키워드 유형(12개 카테고리) 선택 → 프리셋 자동 적용 → 분석 실행 2단계 UI를 구현하여, 사용자가 유형만 선택하면 최적화된 설정으로 분석을 실행할 수 있도록 한다.

**Architecture:** DB에 `analysis_presets` 테이블 추가하여 Admin 패널에서 프리셋을 관리한다. `collection_jobs`에 `keyword_type` + `applied_preset` 스냅샷을 저장한다. 프론트엔드는 Step 1(프리셋 선택 카드) → Step 2(기존 트리거 폼 + 프리셋 적용) 2단계 흐름으로 구성한다.

**Tech Stack:** Drizzle ORM · tRPC 11 · shadcn/ui · TanStack Query 5 · Zod 3

**Spec:** `docs/superpowers/specs/2026-04-09-analysis-preset-design.md`

---

## File Structure

### 신규 파일

| 파일                                                     | 역할                                  |
| -------------------------------------------------------- | ------------------------------------- |
| `packages/core/src/db/schema/presets.ts`                 | analysisPresets 테이블 Drizzle 스키마 |
| `packages/core/src/db/seed-presets.ts`                   | 12개 기본 프리셋 시드 데이터          |
| `apps/web/src/server/trpc/routers/admin/presets.ts`      | Admin 프리셋 CRUD tRPC 라우터         |
| `apps/web/src/server/trpc/routers/presets.ts`            | 사용자용 프리셋 조회 tRPC 라우터      |
| `apps/web/src/components/analysis/analysis-launcher.tsx` | Step 1/2 전환 제어 래퍼               |
| `apps/web/src/components/analysis/preset-selector.tsx`   | Step 1: 카테고리 탭 + 카드 그리드     |
| `apps/web/src/components/analysis/preset-card.tsx`       | 개별 유형 카드 컴포넌트               |
| `apps/web/src/app/admin/presets/page.tsx`                | Admin 프리셋 관리 페이지              |
| `apps/web/src/components/admin/preset-form-dialog.tsx`   | 프리셋 생성/편집 Dialog               |

### 수정 파일

| 파일                                                | 변경                                            |
| --------------------------------------------------- | ----------------------------------------------- |
| `packages/core/src/db/schema/collections.ts`        | `keyword_type`, `applied_preset` 컬럼 추가      |
| `packages/core/src/db/schema/index.ts`              | presets export 추가                             |
| `packages/core/src/index.ts`                        | presets export 확인 (schema/index.ts 통해 자동) |
| `apps/web/src/server/trpc/routers/admin/index.ts`   | presetsRouter 등록                              |
| `apps/web/src/server/trpc/router.ts`                | presets 라우터 등록                             |
| `apps/web/src/server/trpc/routers/analysis.ts`      | trigger에 keywordType 입력 + 프리셋 스냅샷 저장 |
| `apps/web/src/app/dashboard/page.tsx`               | TriggerForm → AnalysisLauncher 교체             |
| `apps/web/src/components/analysis/trigger-form.tsx` | preset prop 추가 + 프리셋 기본값 적용           |

---

### Task 1: DB 스키마 — analysis_presets 테이블 생성

**Files:**

- Create: `packages/core/src/db/schema/presets.ts`
- Modify: `packages/core/src/db/schema/index.ts`

- [ ] **Step 1: presets.ts 스키마 파일 생성**

```typescript
// packages/core/src/db/schema/presets.ts
import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  uuid,
  index,
} from 'drizzle-orm/pg-core';

export const analysisPresets = pgTable(
  'analysis_presets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').unique().notNull(),
    category: text('category').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    icon: text('icon').notNull(),
    highlight: text('highlight'),
    sortOrder: integer('sort_order').notNull().default(0),
    sources: jsonb('sources').notNull().$type<Record<string, boolean>>(),
    customSourceIds: jsonb('custom_source_ids').notNull().$type<string[]>().default([]),
    limits: jsonb('limits').notNull().$type<{
      naverArticles: number;
      youtubeVideos: number;
      communityPosts: number;
      commentsPerItem: number;
    }>(),
    optimization: text('optimization', {
      enum: ['none', 'light', 'standard', 'aggressive'],
    })
      .notNull()
      .default('standard'),
    skippedModules: jsonb('skipped_modules').notNull().$type<string[]>().default([]),
    enableItemAnalysis: boolean('enable_item_analysis').notNull().default(false),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('analysis_presets_enabled_idx').on(table.enabled),
    index('analysis_presets_category_idx').on(table.category),
  ],
);

export type AnalysisPreset = typeof analysisPresets.$inferSelect;
export type NewAnalysisPreset = typeof analysisPresets.$inferInsert;
```

- [ ] **Step 2: schema/index.ts에 export 추가**

`packages/core/src/db/schema/index.ts`에 다음 줄 추가:

```typescript
export * from './presets';
```

- [ ] **Step 3: DB 스키마 동기화**

Run: `pnpm db:push`
Expected: `analysis_presets` 테이블 생성 완료

- [ ] **Step 4: 커밋**

```bash
git add packages/core/src/db/schema/presets.ts packages/core/src/db/schema/index.ts
git commit -m "feat: analysis_presets 테이블 스키마 추가"
```

---

### Task 2: DB 스키마 — collection_jobs 변경

**Files:**

- Modify: `packages/core/src/db/schema/collections.ts`

- [ ] **Step 1: collection_jobs에 컬럼 추가**

`packages/core/src/db/schema/collections.ts`의 `collectionJobs` 테이블 정의에 `isFeatured` 필드 앞에 다음 2개 컬럼 추가:

```typescript
    keywordType: text('keyword_type'),
    appliedPreset: jsonb('applied_preset').$type<{
      slug: string;
      title: string;
      sources: Record<string, boolean>;
      limits: {
        naverArticles: number;
        youtubeVideos: number;
        communityPosts: number;
        commentsPerItem: number;
      };
      optimization: 'none' | 'light' | 'standard' | 'aggressive';
      skippedModules: string[];
      enableItemAnalysis: boolean;
      customized: boolean;
    }>(),
```

- [ ] **Step 2: DB 스키마 동기화**

Run: `pnpm db:push`
Expected: `keyword_type`, `applied_preset` 컬럼 추가됨

- [ ] **Step 3: 커밋**

```bash
git add packages/core/src/db/schema/collections.ts
git commit -m "feat: collection_jobs에 keyword_type, applied_preset 컬럼 추가"
```

---

### Task 3: 시드 데이터 — 12개 기본 프리셋

**Files:**

- Create: `packages/core/src/db/seed-presets.ts`

- [ ] **Step 1: 시드 파일 생성**

```typescript
// packages/core/src/db/seed-presets.ts
import { getDb } from '../db';
import { analysisPresets } from './schema/presets';

const PRESET_SEEDS = [
  // 핵심 활용
  {
    slug: 'politics',
    category: '핵심 활용',
    title: '정치 캠프',
    description:
      '실시간 여론 추적, 지지율 추정, 프레임 전쟁 분석으로 선거 전략을 데이터 기반으로 수립합니다.',
    icon: 'Target',
    highlight: '의사결정 시간 수일 → 수시간',
    sortOrder: 0,
    sources: { naver: true, youtube: true, dcinside: true, fmkorea: true, clien: true },
    customSourceIds: [],
    limits: { naverArticles: 500, youtubeVideos: 50, communityPosts: 100, commentsPerItem: 500 },
    optimization: 'standard' as const,
    skippedModules: [],
    enableItemAnalysis: false,
  },
  {
    slug: 'pr_crisis',
    category: '핵심 활용',
    title: 'PR / 위기관리',
    description:
      '위기 시나리오 3개와 대응 전략을 자동 생성합니다. 골든타임 안에 전략적 판단이 가능합니다.',
    icon: 'Shield',
    highlight: '수동 클리핑 주 20시간 → 0',
    sortOrder: 1,
    sources: { naver: true, youtube: true, dcinside: true, fmkorea: true, clien: false },
    customSourceIds: [],
    limits: { naverArticles: 500, youtubeVideos: 30, communityPosts: 50, commentsPerItem: 500 },
    optimization: 'standard' as const,
    skippedModules: ['winSimulation'],
    enableItemAnalysis: false,
  },
  {
    slug: 'corporate_reputation',
    category: '핵심 활용',
    title: '기업 평판 관리',
    description: '네이버·유튜브·커뮤니티 전체를 통합 분석하여 경영진 보고서를 자동 생성합니다.',
    icon: 'LineChart',
    highlight: '보고서 작성 3일 → 자동 생성',
    sortOrder: 2,
    sources: { naver: true, youtube: true, dcinside: true, fmkorea: true, clien: true },
    customSourceIds: [],
    limits: { naverArticles: 500, youtubeVideos: 50, communityPosts: 50, commentsPerItem: 300 },
    optimization: 'standard' as const,
    skippedModules: ['frameWar', 'winSimulation'],
    enableItemAnalysis: false,
  },
  {
    slug: 'entertainment',
    category: '핵심 활용',
    title: '연예인 / 기획사',
    description: '아티스트·배우의 온라인 반응을 실시간 추적하고, 팬덤 동향과 리스크를 분석합니다.',
    icon: 'Sparkles',
    highlight: '팬덤 여론 분석 자동화',
    sortOrder: 3,
    sources: { naver: true, youtube: true, dcinside: true, fmkorea: true, clien: false },
    customSourceIds: [],
    limits: { naverArticles: 300, youtubeVideos: 100, communityPosts: 100, commentsPerItem: 500 },
    optimization: 'standard' as const,
    skippedModules: ['approvalRating', 'winSimulation'],
    enableItemAnalysis: true,
  },
  // 산업 특화
  {
    slug: 'policy_research',
    category: '산업 특화',
    title: '정책 연구 / 싱크탱크',
    description:
      '특정 정책에 대한 국민 여론 구조를 파악하고, 정책 보고서의 실증 근거로 활용합니다.',
    icon: 'Landmark',
    highlight: '정책 수용도 분석 자동화',
    sortOrder: 4,
    sources: { naver: true, youtube: true, dcinside: true, fmkorea: true, clien: true },
    customSourceIds: [],
    limits: { naverArticles: 500, youtubeVideos: 30, communityPosts: 50, commentsPerItem: 300 },
    optimization: 'standard' as const,
    skippedModules: ['frameWar', 'winSimulation', 'crisisScenario'],
    enableItemAnalysis: false,
  },
  {
    slug: 'finance',
    category: '산업 특화',
    title: '금융 / 투자 리서치',
    description:
      '기업·산업·경제 정책에 대한 시장 심리를 분석합니다. 뉴스 댓글과 커뮤니티 반응에서 선행 지표를 포착합니다.',
    icon: 'TrendingUp',
    highlight: '시장 심리 선행 지표 포착',
    sortOrder: 5,
    sources: { naver: true, youtube: false, dcinside: false, fmkorea: false, clien: true },
    customSourceIds: [],
    limits: { naverArticles: 1000, youtubeVideos: 10, communityPosts: 30, commentsPerItem: 200 },
    optimization: 'light' as const,
    skippedModules: ['frameWar', 'winSimulation', 'crisisScenario', 'approvalRating'],
    enableItemAnalysis: false,
  },
  {
    slug: 'pharma_healthcare',
    category: '산업 특화',
    title: '제약 / 헬스케어',
    description: '신약 출시, 의료 이슈, 건강보험 정책 등에 대한 여론을 추적합니다.',
    icon: 'Bookmark',
    highlight: '의료 이슈 리스크 조기 감지',
    sortOrder: 6,
    sources: { naver: true, youtube: true, dcinside: false, fmkorea: false, clien: true },
    customSourceIds: [],
    limits: { naverArticles: 500, youtubeVideos: 30, communityPosts: 30, commentsPerItem: 200 },
    optimization: 'standard' as const,
    skippedModules: ['frameWar', 'winSimulation', 'approvalRating'],
    enableItemAnalysis: false,
  },
  {
    slug: 'public_sector',
    category: '산업 특화',
    title: '지자체 / 공공기관',
    description:
      '재개발, 교통, 환경 등 지역 현안에 대한 주민 여론을 사전에 파악하여 정책 소통에 활용합니다.',
    icon: 'Building2',
    highlight: '주민 여론 → 정책 소통 전략',
    sortOrder: 7,
    sources: { naver: true, youtube: true, dcinside: true, fmkorea: true, clien: true },
    customSourceIds: [],
    limits: { naverArticles: 500, youtubeVideos: 30, communityPosts: 50, commentsPerItem: 300 },
    optimization: 'standard' as const,
    skippedModules: ['frameWar', 'winSimulation'],
    enableItemAnalysis: false,
  },
  // 확장 영역
  {
    slug: 'education',
    category: '확장 영역',
    title: '대학 / 교육기관',
    description: '입시 정책 변경, 대학 평판, 교육 이슈에 대한 학부모·학생 여론을 추적합니다.',
    icon: 'GraduationCap',
    highlight: '교육 정책 여론 즉시 파악',
    sortOrder: 8,
    sources: { naver: true, youtube: true, dcinside: false, fmkorea: true, clien: false },
    customSourceIds: [],
    limits: { naverArticles: 300, youtubeVideos: 30, communityPosts: 50, commentsPerItem: 200 },
    optimization: 'standard' as const,
    skippedModules: ['frameWar', 'winSimulation', 'approvalRating', 'crisisScenario'],
    enableItemAnalysis: false,
  },
  {
    slug: 'sports',
    category: '확장 영역',
    title: '스포츠 / e스포츠',
    description: '선수 이적, 팀 성적에 따른 팬 반응을 실시간 추적합니다.',
    icon: 'Dumbbell',
    highlight: '팬 반응 실시간 추적',
    sortOrder: 9,
    sources: { naver: true, youtube: true, dcinside: true, fmkorea: true, clien: false },
    customSourceIds: [],
    limits: { naverArticles: 300, youtubeVideos: 50, communityPosts: 100, commentsPerItem: 300 },
    optimization: 'standard' as const,
    skippedModules: ['approvalRating', 'winSimulation', 'crisisScenario'],
    enableItemAnalysis: true,
  },
  {
    slug: 'legal',
    category: '확장 영역',
    title: '법률 / 로펌',
    description: '소송 관련 여론전, 기업 분쟁 시 여론 동향을 파악하여 법적 전략 수립을 지원합니다.',
    icon: 'Briefcase',
    highlight: '여론재판 리스크 모니터링',
    sortOrder: 10,
    sources: { naver: true, youtube: true, dcinside: true, fmkorea: true, clien: true },
    customSourceIds: [],
    limits: { naverArticles: 500, youtubeVideos: 20, communityPosts: 50, commentsPerItem: 300 },
    optimization: 'standard' as const,
    skippedModules: ['winSimulation', 'approvalRating'],
    enableItemAnalysis: false,
  },
  {
    slug: 'franchise_retail',
    category: '확장 영역',
    title: '프랜차이즈 / 유통',
    description:
      '가맹점 이슈, 소비자 불매운동, 제품 리콜 등 브랜드 위기를 조기 감지하고 대응합니다.',
    icon: 'ExternalLink',
    highlight: '불매운동 조기 감지 → 대응',
    sortOrder: 11,
    sources: { naver: true, youtube: true, dcinside: true, fmkorea: true, clien: true },
    customSourceIds: [],
    limits: { naverArticles: 500, youtubeVideos: 30, communityPosts: 100, commentsPerItem: 500 },
    optimization: 'standard' as const,
    skippedModules: ['winSimulation', 'approvalRating'],
    enableItemAnalysis: false,
  },
];

export async function seedPresets() {
  const db = getDb();

  for (const seed of PRESET_SEEDS) {
    await db
      .insert(analysisPresets)
      .values(seed)
      .onConflictDoNothing({ target: analysisPresets.slug });
  }

  console.log(`[seed] ${PRESET_SEEDS.length}개 분석 프리셋 시드 완료`);
}
```

- [ ] **Step 2: 시드 실행 스크립트를 package.json에 추가**

`packages/core/package.json`의 `scripts`에 추가:

```json
"db:seed-presets": "tsx src/db/seed-presets.ts"
```

시드 파일 하단에 직접 실행 코드 추가:

```typescript
// 직접 실행 시
seedPresets()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

- [ ] **Step 3: 시드 실행**

Run: `cd packages/core && pnpm db:seed-presets`
Expected: `[seed] 12개 분석 프리셋 시드 완료`

- [ ] **Step 4: 커밋**

```bash
git add packages/core/src/db/seed-presets.ts packages/core/package.json
git commit -m "feat: 12개 분석 프리셋 시드 데이터 추가"
```

---

### Task 4: tRPC — Admin 프리셋 CRUD 라우터

**Files:**

- Create: `apps/web/src/server/trpc/routers/admin/presets.ts`
- Modify: `apps/web/src/server/trpc/routers/admin/index.ts`

- [ ] **Step 1: Admin 프리셋 라우터 생성**

```typescript
// apps/web/src/server/trpc/routers/admin/presets.ts
import { z } from 'zod';
import { eq, asc, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, systemAdminProcedure } from '../../init';
import { analysisPresets } from '@krdn/core';

const presetInputSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_]+$/),
  category: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(500),
  icon: z.string().min(1).max(50),
  highlight: z.string().max(200).nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
  sources: z.record(z.string(), z.boolean()),
  customSourceIds: z.array(z.string().uuid()).default([]),
  limits: z.object({
    naverArticles: z.number().int().min(10).max(5000),
    youtubeVideos: z.number().int().min(5).max(500),
    communityPosts: z.number().int().min(5).max(500),
    commentsPerItem: z.number().int().min(10).max(2000),
  }),
  optimization: z.enum(['none', 'light', 'standard', 'aggressive']).default('standard'),
  skippedModules: z.array(z.string()).default([]),
  enableItemAnalysis: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

export const adminPresetsRouter = router({
  list: systemAdminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(analysisPresets).orderBy(asc(analysisPresets.sortOrder));
  }),

  create: systemAdminProcedure.input(presetInputSchema).mutation(async ({ input, ctx }) => {
    const [row] = await ctx.db.insert(analysisPresets).values(input).returning();
    return row;
  }),

  update: systemAdminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        slug: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[a-z0-9_]+$/)
          .optional(),
        category: z.string().min(1).optional(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().min(1).max(500).optional(),
        icon: z.string().min(1).max(50).optional(),
        highlight: z.string().max(200).nullable().optional(),
        sortOrder: z.number().int().min(0).optional(),
        sources: z.record(z.string(), z.boolean()).optional(),
        customSourceIds: z.array(z.string().uuid()).optional(),
        limits: z
          .object({
            naverArticles: z.number().int().min(10).max(5000),
            youtubeVideos: z.number().int().min(5).max(500),
            communityPosts: z.number().int().min(5).max(500),
            commentsPerItem: z.number().int().min(10).max(2000),
          })
          .optional(),
        optimization: z.enum(['none', 'light', 'standard', 'aggressive']).optional(),
        skippedModules: z.array(z.string()).optional(),
        enableItemAnalysis: z.boolean().optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...fields } = input;
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) patch[key] = value;
      }

      const [row] = await ctx.db
        .update(analysisPresets)
        .set(patch)
        .where(eq(analysisPresets.id, id))
        .returning();
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: '프리셋을 찾을 수 없습니다.' });
      return row;
    }),

  delete: systemAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const [row] = await ctx.db
        .update(analysisPresets)
        .set({ enabled: false, updatedAt: new Date() })
        .where(eq(analysisPresets.id, input.id))
        .returning();
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: '프리셋을 찾을 수 없습니다.' });
      return { ok: true };
    }),

  reorder: systemAdminProcedure
    .input(z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int() })))
    .mutation(async ({ input, ctx }) => {
      for (const item of input) {
        await ctx.db
          .update(analysisPresets)
          .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
          .where(eq(analysisPresets.id, item.id));
      }
      return { ok: true };
    }),
});
```

- [ ] **Step 2: admin/index.ts에 라우터 등록**

`apps/web/src/server/trpc/routers/admin/index.ts`에 추가:

```typescript
import { adminPresetsRouter } from './presets';
```

`adminRouter`의 `router({})` 안에 추가:

```typescript
  presets: adminPresetsRouter,
```

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/server/trpc/routers/admin/presets.ts apps/web/src/server/trpc/routers/admin/index.ts
git commit -m "feat: Admin 프리셋 CRUD tRPC 라우터 추가"
```

---

### Task 5: tRPC — 사용자용 프리셋 조회 라우터

**Files:**

- Create: `apps/web/src/server/trpc/routers/presets.ts`
- Modify: `apps/web/src/server/trpc/router.ts`

- [ ] **Step 1: 사용자용 프리셋 라우터 생성**

```typescript
// apps/web/src/server/trpc/routers/presets.ts
import { asc, eq } from 'drizzle-orm';
import { router, protectedProcedure } from '../init';
import { analysisPresets } from '@krdn/core';

export const presetsRouter = router({
  listEnabled: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: analysisPresets.id,
        slug: analysisPresets.slug,
        category: analysisPresets.category,
        title: analysisPresets.title,
        description: analysisPresets.description,
        icon: analysisPresets.icon,
        highlight: analysisPresets.highlight,
        sources: analysisPresets.sources,
        customSourceIds: analysisPresets.customSourceIds,
        limits: analysisPresets.limits,
        optimization: analysisPresets.optimization,
        skippedModules: analysisPresets.skippedModules,
        enableItemAnalysis: analysisPresets.enableItemAnalysis,
      })
      .from(analysisPresets)
      .where(eq(analysisPresets.enabled, true))
      .orderBy(asc(analysisPresets.sortOrder));
  }),
});
```

- [ ] **Step 2: router.ts에 등록**

`apps/web/src/server/trpc/router.ts`에 추가:

```typescript
import { presetsRouter } from './routers/presets';
```

`appRouter`의 `router({})` 안에 추가:

```typescript
  presets: presetsRouter,
```

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/server/trpc/routers/presets.ts apps/web/src/server/trpc/router.ts
git commit -m "feat: 사용자용 프리셋 조회 tRPC 라우터 추가"
```

---

### Task 6: tRPC — analysis.trigger에 keywordType 추가

**Files:**

- Modify: `apps/web/src/server/trpc/routers/analysis.ts`

- [ ] **Step 1: trigger input에 keywordType 추가**

`apps/web/src/server/trpc/routers/analysis.ts`의 `trigger` 뮤테이션 input schema에 추가:

```typescript
      keywordType: z.string().optional(),
```

- [ ] **Step 2: trigger mutation 로직에 프리셋 처리 추가**

`trigger` mutation의 `async ({ input, ctx })` 내부, 데모 가드 체크 후 + DB insert 전 사이에 프리셋 조회 및 스냅샷 생성 로직 추가:

```typescript
// 프리셋 조회 및 스냅샷 생성
let keywordType: string | null = null;
let appliedPreset: Record<string, unknown> | null = null;

if (input.keywordType) {
  const [preset] = await ctx.db
    .select()
    .from(analysisPresets)
    .where(eq(analysisPresets.slug, input.keywordType))
    .limit(1);

  if (preset) {
    keywordType = preset.slug;

    // 프리셋 스냅샷 생성
    appliedPreset = {
      slug: preset.slug,
      title: preset.title,
      sources: preset.sources,
      limits: preset.limits,
      optimization: preset.optimization,
      skippedModules: preset.skippedModules,
      enableItemAnalysis: preset.enableItemAnalysis,
      customized: false,
    };

    // 프리셋의 skippedModules 적용 (데모 가드와 병합)
    if (!skippedModules) {
      skippedModules = preset.skippedModules as string[];
    } else {
      // 데모 가드 + 프리셋 스킵 모듈 합집합
      const merged = new Set([...skippedModules, ...(preset.skippedModules as string[])]);
      skippedModules = [...merged];
    }

    // 사용자가 프리셋 값을 변경했는지 확인
    const presetSources = preset.sources as Record<string, boolean>;
    const presetLimits = preset.limits as Record<string, number>;
    const inputSources = input.sources ?? [];
    const inputLimits = input.limits;

    const sourcesChanged =
      inputSources.length > 0 &&
      JSON.stringify(
        Object.keys(presetSources)
          .filter((k) => presetSources[k])
          .sort(),
      ) !== JSON.stringify([...inputSources].sort());
    const limitsChanged =
      inputLimits && JSON.stringify(inputLimits) !== JSON.stringify(presetLimits);

    if (sourcesChanged || limitsChanged) {
      (appliedPreset as Record<string, unknown>).customized = true;
    }
  }
}
```

- [ ] **Step 3: DB insert에 keywordType, appliedPreset 추가**

`ctx.db.insert(collectionJobs).values({})` 안에 추가:

```typescript
        keywordType,
        appliedPreset,
```

- [ ] **Step 4: 파일 상단에 import 추가**

```typescript
import { analysisPresets } from '@krdn/core';
```

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/server/trpc/routers/analysis.ts
git commit -m "feat: analysis.trigger에 keywordType 및 프리셋 스냅샷 저장 추가"
```

---

### Task 7: 프론트엔드 — PresetCard 컴포넌트

**Files:**

- Create: `apps/web/src/components/analysis/preset-card.tsx`

- [ ] **Step 1: PresetCard 컴포넌트 생성**

```typescript
// apps/web/src/components/analysis/preset-card.tsx
'use client';

import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PresetCardProps {
  title: string;
  description: string;
  icon: string;
  highlight?: string | null;
  onClick: () => void;
}

function getIcon(name: string): LucideIcon {
  const Icon = (LucideIcons as Record<string, LucideIcon>)[name];
  return Icon ?? LucideIcons.HelpCircle;
}

export function PresetCard({ title, description, icon, highlight, onClick }: PresetCardProps) {
  const Icon = getIcon(icon);

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:border-primary/50 hover:shadow-md',
        'group relative overflow-hidden',
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm leading-tight">{title}</h3>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</p>
          </div>
        </div>
        {highlight && (
          <div className="text-[11px] text-primary/80 flex items-center gap-1">
            <LucideIcons.Zap className="h-3 w-3 shrink-0" />
            {highlight}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/src/components/analysis/preset-card.tsx
git commit -m "feat: PresetCard 컴포넌트 추가"
```

---

### Task 8: 프론트엔드 — PresetSelector 컴포넌트

**Files:**

- Create: `apps/web/src/components/analysis/preset-selector.tsx`

- [ ] **Step 1: PresetSelector 컴포넌트 생성**

```typescript
// apps/web/src/components/analysis/preset-selector.tsx
'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Settings2 } from 'lucide-react';
import { trpcClient } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PresetCard } from './preset-card';

export interface PresetData {
  id: string;
  slug: string;
  category: string;
  title: string;
  description: string;
  icon: string;
  highlight: string | null;
  sources: Record<string, boolean>;
  customSourceIds: string[];
  limits: {
    naverArticles: number;
    youtubeVideos: number;
    communityPosts: number;
    commentsPerItem: number;
  };
  optimization: 'none' | 'light' | 'standard' | 'aggressive';
  skippedModules: string[];
  enableItemAnalysis: boolean;
}

interface PresetSelectorProps {
  onSelect: (preset: PresetData) => void;
  onSkip: () => void;
}

const CATEGORY_ORDER = ['핵심 활용', '산업 특화', '확장 영역'];

export function PresetSelector({ onSelect, onSkip }: PresetSelectorProps) {
  const { data: presets, isLoading } = useQuery({
    queryKey: ['presets', 'enabled'],
    queryFn: () => trpcClient.presets.listEnabled.query(),
    staleTime: 5 * 60 * 1000,
  });

  const grouped = useMemo(() => {
    if (!presets) return {};
    const map: Record<string, PresetData[]> = {};
    for (const p of presets) {
      const cat = p.category;
      if (!map[cat]) map[cat] = [];
      map[cat].push(p as PresetData);
    }
    return map;
  }, [presets]);

  const categories = CATEGORY_ORDER.filter((c) => grouped[c]?.length);

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">분석 유형 선택</CardTitle>
        <p className="text-sm text-muted-foreground">
          유형을 선택하면 최적화된 설정이 자동 적용됩니다.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            사용 가능한 프리셋이 없습니다.
          </p>
        ) : (
          <Tabs defaultValue={categories[0]}>
            <TabsList className="w-full">
              {categories.map((cat) => (
                <TabsTrigger key={cat} value={cat} className="flex-1 text-xs">
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
            {categories.map((cat) => (
              <TabsContent key={cat} value={cat} className="mt-3">
                <div className="grid grid-cols-2 gap-3">
                  {grouped[cat]?.map((preset) => (
                    <PresetCard
                      key={preset.id}
                      title={preset.title}
                      description={preset.description}
                      icon={preset.icon}
                      highlight={preset.highlight}
                      onClick={() => onSelect(preset)}
                    />
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}

        <div className="text-center pt-2">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={onSkip}>
            <Settings2 className="h-3.5 w-3.5 mr-1" />
            직접 설정으로 시작
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/src/components/analysis/preset-selector.tsx
git commit -m "feat: PresetSelector 카테고리 탭 + 카드 그리드 컴포넌트 추가"
```

---

### Task 9: 프론트엔드 — TriggerForm 프리셋 대응 수정

**Files:**

- Modify: `apps/web/src/components/analysis/trigger-form.tsx`

- [ ] **Step 1: TriggerFormProps에 preset 관련 prop 추가**

`trigger-form.tsx`의 `TriggerFormProps` 인터페이스를 수정:

```typescript
interface TriggerFormProps {
  onJobStarted: (jobId: number) => void;
  preset?: {
    slug: string;
    title: string;
    icon: string;
    sources: Record<string, boolean>;
    customSourceIds: string[];
    limits: {
      naverArticles: number;
      youtubeVideos: number;
      communityPosts: number;
      commentsPerItem: number;
    };
    optimization: 'none' | 'light' | 'standard' | 'aggressive';
    skippedModules: string[];
    enableItemAnalysis: boolean;
  } | null;
  onChangePreset?: () => void;
}
```

- [ ] **Step 2: 프리셋 기본값 적용 useEffect 추가**

`TriggerForm` 컴포넌트 내부, 기존 `useEffect` 블록들 아래에 추가:

```typescript
// 프리셋 기본값 적용
useEffect(() => {
  if (!preset) return;
  const enabledSources = Object.entries(preset.sources)
    .filter(([, v]) => v)
    .map(([k]) => k) as SourceId[];
  setSources(enabledSources);
  setCustomSourceIds(preset.customSourceIds);
  setMaxNaverArticles(preset.limits.naverArticles);
  setMaxYoutubeVideos(preset.limits.youtubeVideos);
  setMaxCommunityPosts(preset.limits.communityPosts);
  setMaxCommentsPerItem(preset.limits.commentsPerItem);
  setOptimizationPreset(preset.optimization);
  setEnableItemAnalysis(preset.enableItemAnalysis);
}, [preset]);
```

- [ ] **Step 3: 폼 상단에 선택된 유형 뱃지 추가**

`<form>` 태그 안, 키워드 입력 `<div>` 바로 앞에 추가:

```typescript
          {/* 선택된 프리셋 표시 */}
          {preset && onChangePreset && (
            <div className="flex items-center justify-between rounded-lg border bg-primary/5 border-primary/20 p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-primary">{preset.title}</span>
                <span className="text-xs text-muted-foreground">프리셋 적용됨</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={onChangePreset}
              >
                유형 변경
              </Button>
            </div>
          )}
```

- [ ] **Step 4: handleSubmit에 keywordType 포함**

`triggerMutation.mutate()` 호출 부분에 `keywordType` 추가:

기존:

```typescript
    triggerMutation.mutate({
      keyword: keyword.trim(),
      sources,
```

변경:

```typescript
    triggerMutation.mutate({
      keyword: keyword.trim(),
      sources,
      ...(preset?.slug && { keywordType: preset.slug }),
```

- [ ] **Step 5: mutationFn 타입에 keywordType 추가**

`triggerMutation`의 `mutationFn` input 타입에 추가:

```typescript
      keywordType?: string;
```

- [ ] **Step 6: 함수 시그니처에 preset, onChangePreset 추가**

```typescript
export function TriggerForm({ onJobStarted, preset, onChangePreset }: TriggerFormProps) {
```

- [ ] **Step 7: 커밋**

```bash
git add apps/web/src/components/analysis/trigger-form.tsx
git commit -m "feat: TriggerForm에 프리셋 기본값 적용 및 유형 변경 UI 추가"
```

---

### Task 10: 프론트엔드 — AnalysisLauncher 래퍼 컴포넌트

**Files:**

- Create: `apps/web/src/components/analysis/analysis-launcher.tsx`

- [ ] **Step 1: AnalysisLauncher 컴포넌트 생성**

```typescript
// apps/web/src/components/analysis/analysis-launcher.tsx
'use client';

import { useState } from 'react';
import { PresetSelector, type PresetData } from './preset-selector';
import { TriggerForm } from './trigger-form';

interface AnalysisLauncherProps {
  onJobStarted: (jobId: number) => void;
  isDemo?: boolean;
}

export function AnalysisLauncher({ onJobStarted, isDemo }: AnalysisLauncherProps) {
  const [selectedPreset, setSelectedPreset] = useState<PresetData | null>(null);
  const [step, setStep] = useState<'select' | 'configure'>('select');

  // 데모 사용자는 프리셋 선택 건너뜀
  if (isDemo) {
    return <TriggerForm onJobStarted={onJobStarted} />;
  }

  // Step 1: 프리셋 선택
  if (step === 'select') {
    return (
      <PresetSelector
        onSelect={(preset) => {
          setSelectedPreset(preset);
          setStep('configure');
        }}
        onSkip={() => {
          setSelectedPreset(null);
          setStep('configure');
        }}
      />
    );
  }

  // Step 2: 트리거 폼 (프리셋 적용)
  return (
    <TriggerForm
      onJobStarted={onJobStarted}
      preset={selectedPreset}
      onChangePreset={() => {
        setSelectedPreset(null);
        setStep('select');
      }}
    />
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/src/components/analysis/analysis-launcher.tsx
git commit -m "feat: AnalysisLauncher Step 1/2 전환 래퍼 컴포넌트 추가"
```

---

### Task 11: 대시보드 — TriggerForm → AnalysisLauncher 교체

**Files:**

- Modify: `apps/web/src/app/dashboard/page.tsx`

- [ ] **Step 1: import 변경**

기존:

```typescript
import { TriggerForm } from '@/components/analysis/trigger-form';
```

변경:

```typescript
import { AnalysisLauncher } from '@/components/analysis/analysis-launcher';
```

- [ ] **Step 2: AnalysisTab 내 TriggerForm을 AnalysisLauncher로 교체**

대시보드 `AnalysisTab` 컴포넌트에서 `<TriggerForm onJobStarted={onJobStarted} />` 를 찾아서:

```typescript
<AnalysisLauncher onJobStarted={onJobStarted} isDemo={isDemo} />
```

로 교체. `isDemo`가 `AnalysisTab` 스코프에 없다면, 상위에서 `useSession`의 `userRole === 'demo'` 값을 전달.

- [ ] **Step 3: 빌드 확인**

Run: `pnpm build`
Expected: 빌드 성공 (타입 에러 없음)

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/app/dashboard/page.tsx
git commit -m "feat: 대시보드에서 TriggerForm을 AnalysisLauncher로 교체"
```

---

### Task 12: Admin UI — 프리셋 관리 페이지

**Files:**

- Create: `apps/web/src/app/admin/presets/page.tsx`
- Create: `apps/web/src/components/admin/preset-form-dialog.tsx`

- [ ] **Step 1: 프리셋 관리 페이지 생성**

```typescript
// apps/web/src/app/admin/presets/page.tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Power, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PresetFormDialog } from '@/components/admin/preset-form-dialog';

type PresetRow = Awaited<ReturnType<typeof trpcClient.admin.presets.list.query>>[number];

export default function AdminPresetsPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PresetRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'presets'],
    queryFn: () => trpcClient.admin.presets.list.query(),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; enabled?: boolean }) =>
      trpcClient.admin.presets.update.mutate(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'presets'] });
      toast.success('변경되었습니다.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => trpcClient.admin.presets.delete.mutate({ id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'presets'] });
      toast.success('비활성화되었습니다.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">분석 프리셋</h1>
          <p className="text-sm text-muted-foreground mt-1">
            키워드 유형별 분석 설정 프리셋을 관리합니다.
          </p>
        </div>
        <Button onClick={() => { setEditTarget(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          프리셋 추가
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">등록된 프리셋</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data || data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              등록된 프리셋이 없습니다.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>순서</TableHead>
                  <TableHead>제목</TableHead>
                  <TableHead>카테고리</TableHead>
                  <TableHead>최적화</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-right">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((preset) => (
                  <TableRow key={preset.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {preset.sortOrder}
                    </TableCell>
                    <TableCell className="font-medium">{preset.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{preset.category}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{preset.optimization}</TableCell>
                    <TableCell>
                      {preset.enabled ? (
                        <Badge variant="default">활성</Badge>
                      ) : (
                        <Badge variant="secondary">비활성</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditTarget(preset);
                            setDialogOpen(true);
                          }}
                          title="편집"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            updateMutation.mutate({ id: preset.id, enabled: !preset.enabled })
                          }
                          disabled={updateMutation.isPending}
                          title={preset.enabled ? '비활성화' : '활성화'}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`"${preset.title}"을(를) 비활성화하시겠습니까?`))
                              deleteMutation.mutate(preset.id);
                          }}
                          disabled={deleteMutation.isPending}
                          title="삭제"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PresetFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editData={editTarget}
      />
    </div>
  );
}
```

- [ ] **Step 2: 프리셋 폼 Dialog 생성**

```typescript
// apps/web/src/components/admin/preset-form-dialog.tsx
'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ALL_MODULES = [
  { name: 'macroView', label: '거시 분석' },
  { name: 'segmentation', label: '세그먼트 분석' },
  { name: 'sentimentFraming', label: '감정/프레임 분석' },
  { name: 'messageImpact', label: '메시지 영향력' },
  { name: 'riskMap', label: '리스크 지도' },
  { name: 'opportunity', label: '기회 분석' },
  { name: 'strategy', label: '전략 도출' },
  { name: 'finalSummary', label: '최종 요약' },
  { name: 'approvalRating', label: '지지율 추정' },
  { name: 'frameWar', label: '프레임 전쟁' },
  { name: 'crisisScenario', label: '위기 시나리오' },
  { name: 'winSimulation', label: '승리 시뮬레이션' },
];

const SOURCE_OPTIONS = [
  { id: 'naver', label: '네이버 뉴스' },
  { id: 'youtube', label: '유튜브' },
  { id: 'dcinside', label: 'DC갤러리' },
  { id: 'fmkorea', label: '에펨코리아' },
  { id: 'clien', label: '클리앙' },
];

interface PresetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: {
    id: string;
    slug: string;
    category: string;
    title: string;
    description: string;
    icon: string;
    highlight: string | null;
    sortOrder: number;
    sources: Record<string, boolean>;
    limits: {
      naverArticles: number;
      youtubeVideos: number;
      communityPosts: number;
      commentsPerItem: number;
    };
    optimization: string;
    skippedModules: unknown;
    enableItemAnalysis: boolean;
  } | null;
}

export function PresetFormDialog({ open, onOpenChange, editData }: PresetFormDialogProps) {
  const qc = useQueryClient();
  const isEdit = !!editData;

  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState('핵심 활용');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('Target');
  const [highlight, setHighlight] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [sources, setSources] = useState<Record<string, boolean>>({
    naver: true, youtube: true, dcinside: true, fmkorea: true, clien: true,
  });
  const [naverArticles, setNaverArticles] = useState(500);
  const [youtubeVideos, setYoutubeVideos] = useState(50);
  const [communityPosts, setCommunityPosts] = useState(50);
  const [commentsPerItem, setCommentsPerItem] = useState(500);
  const [optimization, setOptimization] = useState('standard');
  const [skippedModules, setSkippedModules] = useState<string[]>([]);
  const [enableItemAnalysis, setEnableItemAnalysis] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editData) {
      setSlug(editData.slug);
      setCategory(editData.category);
      setTitle(editData.title);
      setDescription(editData.description);
      setIcon(editData.icon);
      setHighlight(editData.highlight ?? '');
      setSortOrder(editData.sortOrder);
      setSources(editData.sources);
      setNaverArticles(editData.limits.naverArticles);
      setYoutubeVideos(editData.limits.youtubeVideos);
      setCommunityPosts(editData.limits.communityPosts);
      setCommentsPerItem(editData.limits.commentsPerItem);
      setOptimization(editData.optimization);
      setSkippedModules((editData.skippedModules as string[]) ?? []);
      setEnableItemAnalysis(editData.enableItemAnalysis);
    } else {
      setSlug('');
      setCategory('핵심 활용');
      setTitle('');
      setDescription('');
      setIcon('Target');
      setHighlight('');
      setSortOrder(0);
      setSources({ naver: true, youtube: true, dcinside: true, fmkorea: true, clien: true });
      setNaverArticles(500);
      setYoutubeVideos(50);
      setCommunityPosts(50);
      setCommentsPerItem(500);
      setOptimization('standard');
      setSkippedModules([]);
      setEnableItemAnalysis(false);
    }
  }, [open, editData]);

  const createMutation = useMutation({
    mutationFn: () =>
      trpcClient.admin.presets.create.mutate({
        slug,
        category,
        title,
        description,
        icon,
        highlight: highlight || null,
        sortOrder,
        sources,
        customSourceIds: [],
        limits: { naverArticles, youtubeVideos, communityPosts, commentsPerItem },
        optimization: optimization as 'none' | 'light' | 'standard' | 'aggressive',
        skippedModules,
        enableItemAnalysis,
      }),
    onSuccess: () => {
      toast.success('프리셋이 추가되었습니다.');
      qc.invalidateQueries({ queryKey: ['admin', 'presets'] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      trpcClient.admin.presets.update.mutate({
        id: editData!.id,
        slug,
        category,
        title,
        description,
        icon,
        highlight: highlight || null,
        sortOrder,
        sources,
        limits: { naverArticles, youtubeVideos, communityPosts, commentsPerItem },
        optimization: optimization as 'none' | 'light' | 'standard' | 'aggressive',
        skippedModules,
        enableItemAnalysis,
      }),
    onSuccess: () => {
      toast.success('프리셋이 수정되었습니다.');
      qc.invalidateQueries({ queryKey: ['admin', 'presets'] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSave = slug.trim() && title.trim() && description.trim();
  const mutation = isEdit ? updateMutation : createMutation;

  const handleSkipToggle = (moduleName: string, checked: boolean) => {
    setSkippedModules((prev) =>
      checked ? prev.filter((m) => m !== moduleName) : [...prev, moduleName],
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? '프리셋 수정' : '프리셋 추가'}</DialogTitle>
          <DialogDescription>분석 유형별 기본 설정을 구성합니다.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                placeholder="politics"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="title">제목</Label>
              <Input
                id="title"
                placeholder="정치 캠프"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">설명</Label>
            <Textarea
              id="description"
              placeholder="유형 설명"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="category">카테고리</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="핵심 활용">핵심 활용</SelectItem>
                  <SelectItem value="산업 특화">산업 특화</SelectItem>
                  <SelectItem value="확장 영역">확장 영역</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="icon">아이콘</Label>
              <Input id="icon" placeholder="Target" value={icon} onChange={(e) => setIcon(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sortOrder">정렬 순서</Label>
              <Input id="sortOrder" type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="highlight">하이라이트</Label>
            <Input id="highlight" placeholder="의사결정 시간 수일 → 수시간" value={highlight} onChange={(e) => setHighlight(e.target.value)} />
          </div>

          {/* 소스 설정 */}
          <div className="grid gap-2 rounded-md border p-3">
            <Label className="text-sm font-medium">소스</Label>
            <div className="flex flex-wrap gap-3">
              {SOURCE_OPTIONS.map((s) => (
                <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={sources[s.id] ?? false}
                    onCheckedChange={(checked) =>
                      setSources((prev) => ({ ...prev, [s.id]: !!checked }))
                    }
                  />
                  <span className="text-sm">{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 수집 한도 */}
          <div className="grid gap-2 rounded-md border p-3">
            <Label className="text-sm font-medium">수집 한도</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-xs">네이버 뉴스</Label>
                <Input type="number" min={10} max={5000} value={naverArticles} onChange={(e) => setNaverArticles(Number(e.target.value))} />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">유튜브 영상</Label>
                <Input type="number" min={5} max={500} value={youtubeVideos} onChange={(e) => setYoutubeVideos(Number(e.target.value))} />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">커뮤니티 게시글</Label>
                <Input type="number" min={5} max={500} value={communityPosts} onChange={(e) => setCommunityPosts(Number(e.target.value))} />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">항목당 댓글</Label>
                <Input type="number" min={10} max={2000} value={commentsPerItem} onChange={(e) => setCommentsPerItem(Number(e.target.value))} />
              </div>
            </div>
          </div>

          {/* 토큰 최적화 */}
          <div className="grid gap-2">
            <Label>토큰 최적화</Label>
            <Select value={optimization} onValueChange={setOptimization}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">없음</SelectItem>
                <SelectItem value="light">경량 (~30%)</SelectItem>
                <SelectItem value="standard">표준 (~60%)</SelectItem>
                <SelectItem value="aggressive">강력 (~80%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 분석 모듈 */}
          <div className="grid gap-2 rounded-md border p-3">
            <Label className="text-sm font-medium">분석 모듈 (체크 해제 = 스킵)</Label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_MODULES.map((m) => (
                <label key={m.name} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={!skippedModules.includes(m.name)}
                    onCheckedChange={(checked) => handleSkipToggle(m.name, !!checked)}
                  />
                  <span className="text-xs">{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 개별 감정 분석 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={enableItemAnalysis}
              onCheckedChange={(checked) => setEnableItemAnalysis(!!checked)}
            />
            <span className="text-sm">개별 기사/댓글 감정 분석 기본 활성화</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSave || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {isEdit ? '수정' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/app/admin/presets/page.tsx apps/web/src/components/admin/preset-form-dialog.tsx
git commit -m "feat: Admin 프리셋 관리 페이지 및 폼 Dialog 추가"
```

---

### Task 13: 전체 빌드 및 통합 확인

**Files:** (수정 없음, 검증만)

- [ ] **Step 1: 린트 확인**

Run: `pnpm lint`
Expected: 에러 없음

- [ ] **Step 2: 빌드 확인**

Run: `pnpm build`
Expected: 빌드 성공

- [ ] **Step 3: 개발 서버에서 동작 확인**

Run: `pnpm dev`

확인 사항:

1. `/dashboard` → 분석 탭 → Step 1 프리셋 선택 카드 표시
2. 카테고리 탭 전환 동작
3. 카드 클릭 → Step 2 트리거 폼 전환 + 프리셋 적용 확인
4. "유형 변경" → Step 1로 복귀
5. "직접 설정으로 시작" → 프리셋 없이 기존 폼 표시
6. `/admin/presets` → 프리셋 목록 + CRUD 동작

- [ ] **Step 4: 최종 커밋 (필요한 경우)**

빌드/린트 수정 후 커밋:

```bash
git add -A
git commit -m "fix: 빌드 및 린트 오류 수정"
```
