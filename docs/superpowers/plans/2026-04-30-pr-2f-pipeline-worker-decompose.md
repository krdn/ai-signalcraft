# PR 2-F: pipeline-worker.ts 분해 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `packages/core/src/queue/pipeline-worker.ts` (615줄) 단일 거대 핸들러를 `job.name` 분기별 헬퍼 모듈로 분해하여 인지 부하를 줄이고 향후 단위 테스트를 가능하게 한다. 외부 표면(`createPipelineHandler`, `worker-process.ts` import 경로, BullMQ job data shape)은 그대로 유지한다.

**Architecture:** 2-B(`pipeline-orchestrator` 분해)와 동일한 **평탄 헬퍼 파일 패턴**을 따른다. 디렉토리를 새로 파지 않고 `packages/core/src/queue/` 하위에 `pipeline-worker-*.ts` 파일을 추가한다. 메인 `pipeline-worker.ts`는 `createPipelineHandler` 진입과 분기만 담당하는 dispatcher로 축소한다.

**분해 원칙:**

1. **Job data shape 보존** — `{ source, dbJobId, ... }` 입력은 어떤 헬퍼에도 그대로 전달
2. **외부 시그니처 보존** — `createPipelineHandler(): (job: Job) => Promise<any>` 변경 금지
3. **로깅 prefix 보존** — 운영 로그 grep 패턴(`[normalize-naver]`, `[persist]`, `[classify]`) 동일
4. **취소 / 게이트 / 부분 실패 동작** 동일 (`isPipelineCancelled`, `awaitStageGate` 호출 위치 보존)
5. **단일 revert 가능** — PR 단일 커밋이 아니어도 좋으나, 머지 시 revert 한 번으로 원복 가능

**Tech Stack:** TypeScript 5, BullMQ 5, Drizzle ORM, vitest 3, pnpm workspace.

---

## File Structure (분해 후)

| 파일                                                                 | 책임                                                                                                              | 예상 라인 |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------- |
| `packages/core/src/queue/pipeline-worker.ts`                         | dispatcher: `job.name` 분기 → 핸들러 호출                                                                         | ~60       |
| `packages/core/src/queue/pipeline-worker-naver.ts`                   | `normalize-naver`: 기사 결과에서 댓글 병렬 수집 (semaphore CONCURRENCY=4)                                         | ~140      |
| `packages/core/src/queue/pipeline-worker-youtube.ts`                 | `normalize-youtube` 신/구 경로: 영상+댓글 분리 / 레거시 댓글 수집                                                 | ~180      |
| `packages/core/src/queue/pipeline-worker-normalize.ts`               | `normalize-*` 진입점: 자식 결과 수집, feed/community 분기, naver/youtube 위임                                     | ~80       |
| `packages/core/src/queue/pipeline-worker-persist.ts`                 | `persist`: 정규화 결과 DB 저장, sourceId→dbId 매핑, keyword linkage, whisper enqueue, embedding, classify trigger | ~210      |
| `packages/core/src/queue/pipeline-worker-classify.ts`                | `classify`: item-analysis + analysis trigger                                                                      | ~50       |
| `packages/core/src/queue/__tests__/pipeline-worker-dispatch.test.ts` | dispatcher 라우팅 단위 테스트 (신규)                                                                              | ~60       |
| `packages/core/tests/worker.test.ts`                                 | 기존 정적 grep 테스트를 디렉토리 전체 검색으로 업데이트                                                           | (수정)    |

**Why 평탄 패턴:** 2-B에서 `pipeline-input-prep.ts`/`pipeline-pre-stages.ts`/`pipeline-post-stages.ts`로 같은 디렉토리에 평탄하게 분해했고 import 경로(`'../pipeline'` 등) 깊이가 변하지 않음. 마스터플랜의 `pipeline-worker/handlers/` 서브디렉토리 안은 import 깊이가 한 단계 늘어 패턴이 갈라진다. 일관성 우선.

**Why source별 분리(naver/youtube)만 별도 파일:** community/feed는 짧고(공동 ~50줄) normalize 진입점에 inline 유지. naver(140줄)와 youtube(180줄)만 자체 파일로 분리해 가독성 확보.

---

## Pre-flight Check

- [ ] **Step 0-1: 현재 분기 PASS 상태 확인**

```bash
pnpm typecheck
pnpm -r test
```

기대: 모든 워크스페이스 PASS. 실패하면 본 plan 진입 전 별도 처리.

- [ ] **Step 0-2: 작업 브랜치 생성**

```bash
git checkout -b refactor/pr-2f-pipeline-worker
git status  # clean
```

기대: clean working tree, branch refactor/pr-2f-pipeline-worker.

---

## Task 1: classify 핸들러 분리 (가장 작고 독립적)

**근거:** 615줄 중 35줄만 차지. 외부 의존(`analyzeItems`, `awaitStageGate`, `triggerAnalysis`, `appendJobEvent`)이 분명. 가장 안전한 첫 분리.

**Files:**

- Create: `packages/core/src/queue/pipeline-worker-classify.ts`
- Modify: `packages/core/src/queue/pipeline-worker.ts:579-613`

- [ ] **Step 1: 새 파일 생성 (`pipeline-worker-classify.ts`)**

```typescript
// classify 핸들러 — 증분 item-analysis + analysis 트리거
import type { Job } from 'bullmq';
import { isPipelineCancelled } from '../pipeline/control';
import { awaitStageGate } from '../pipeline/pipeline-checks';
import { appendJobEvent } from '../pipeline';
import { analyzeItems } from '../analysis/item-analyzer';
import { triggerAnalysis } from './flows';
import { createLogger, logError } from '../utils/logger';

const logger = createLogger('pipeline-worker');

export async function handleClassify(job: Job): Promise<unknown> {
  const { dbJobId: classifyJobId, keyword: classifyKeyword } = job.data;

  if (await isPipelineCancelled(classifyJobId)) {
    logger.info(`[classify] 취소됨 — 스킵 (dbJobId=${classifyJobId})`);
    return { skipped: true, reason: 'cancelled' };
  }

  // 증분 item-analysis — 실패해도 분석은 계속 진행
  try {
    await analyzeItems(classifyJobId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[classify] item-analysis 실패 (분석은 계속): ${msg}`);
    await appendJobEvent(
      classifyJobId,
      'warn',
      `개별 감정 분석 실패 (분석은 계속 진행됨): ${msg}`,
    ).catch((err) => logError('pipeline-worker', err));
  }

  // BP 게이트: 정규화 완료 후 (analysis 트리거 직전)
  if (!(await awaitStageGate(classifyJobId, 'normalize'))) {
    logger.info(`[classify] 게이트 미통과 — 분석 트리거 건너뜀 (dbJobId=${classifyJobId})`);
    return { cancelled: true };
  }

  if (classifyKeyword) {
    await triggerAnalysis(classifyJobId, classifyKeyword);
    logger.info(
      `[classify] 분석 파이프라인 트리거됨: job=${classifyJobId}, keyword=${classifyKeyword}`,
    );
  }
  return { classified: true };
}
```

- [ ] **Step 2: pipeline-worker.ts에서 classify 분기 위임**

`packages/core/src/queue/pipeline-worker.ts:579-613` 의 `if (job.name === 'classify') { ... }` 블록 전체를 다음으로 교체:

```typescript
if (job.name === 'classify') {
  return handleClassify(job);
}
```

상단 import 추가:

```typescript
import { handleClassify } from './pipeline-worker-classify';
```

상단 import 중 더 이상 사용하지 않는 것 제거:

- `analyzeItems` 사용처가 classify뿐이면 제거
- `triggerAnalysis` 사용처가 classify뿐이면 제거
- `appendJobEvent` 사용처가 classify뿐이면 제거
- `logError` 사용처가 classify뿐이면 제거
- `awaitStageGate` 는 `persist`에서도 사용 → 유지

각 import는 grep으로 사용처 재확인 후 제거.

- [ ] **Step 3: 타입체크 + 빌드 + 테스트**

```bash
pnpm -F @ai-signalcraft/core typecheck
pnpm -F @ai-signalcraft/core build
pnpm -F @ai-signalcraft/core test
```

기대: 모두 PASS. `worker.test.ts`의 grep 테스트는 아직 통과(파일 내용 안 바뀜). 실제로는 classify 분기 코드가 dispatcher에서 사라졌지만 import한 헬퍼 안에 그대로 있어 정상.

- [ ] **Step 4: 커밋**

```bash
git add packages/core/src/queue/pipeline-worker.ts \
        packages/core/src/queue/pipeline-worker-classify.ts
git commit -m "$(cat <<'EOF'
refactor(core): pipeline-worker classify 핸들러 분리

615줄 거대 핸들러 분해 (1/4) — classify 분기를 별도 파일로 추출.
외부 시그니처(createPipelineHandler), job data shape, 로깅 prefix 보존.

리팩토링 마스터플랜 Phase 2 PR 2-F.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: persist 핸들러 분리

**Files:**

- Create: `packages/core/src/queue/pipeline-worker-persist.ts`
- Modify: `packages/core/src/queue/pipeline-worker.ts:362-576`

- [ ] **Step 1: 새 파일 생성 (`pipeline-worker-persist.ts`)**

`pipeline-worker.ts:362-576` (persist 분기 전체)을 별도 함수로 추출. job 인자 받아서 처리. 다음 import 모두 옮김:

```typescript
// persist 핸들러 — 정규화 결과 DB 영속화 + 임베딩 + 후속 트리거
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import type { CommunityPost, DataSourceSnapshot } from '@ai-signalcraft/collectors';
import {
  normalizeNaverArticle,
  normalizeNaverComment,
  normalizeYoutubeVideo,
  normalizeYoutubeComment,
  normalizeCommunityPost,
  normalizeCommunityComment,
  normalizeFeedArticle,
  persistArticles,
  persistVideos,
  persistComments,
  updateJobProgress,
  linkArticleKeywords,
  linkVideoKeywords,
} from '../pipeline';
import { isPipelineCancelled } from '../pipeline/control';
import { awaitStageGate } from '../pipeline/pipeline-checks';
import { getDb } from '../db';
import { dataSources } from '../db/schema/sources';
import {
  persistArticleEmbeddings,
  persistCommentEmbeddings,
} from '../analysis/preprocessing/embedding-persist';
import { triggerClassify } from './flows';
import { enqueueWhisperForTopVideos } from './whisper-enqueue';
import { COMMUNITY_SOURCES } from './worker-config';
import { createLogger } from '../utils/logger';

const logger = createLogger('pipeline-worker');

export async function handlePersist(job: Job, jobStartTime: number): Promise<unknown> {
  const { dbJobId } = job.data;

  // 취소 확인
  if (dbJobId && (await isPipelineCancelled(dbJobId))) {
    logger.info(`[persist] 취소됨 — 저장 건너뜀`);
    return { skipped: true, reason: 'cancelled' };
  }

  // BP 게이트
  if (dbJobId && !(await awaitStageGate(dbJobId, 'collection'))) {
    return { cancelled: true };
  }

  const keywordForLink = job.data.keyword as string | undefined;
  const newArticleIds: number[] = [];
  const newVideoIds: number[] = [];

  const childValues = await job.getChildrenValues();

  for (const [_key, value] of Object.entries(childValues)) {
    const normalizeResult = value as any;
    const results = normalizeResult.results || {};
    const jobIdForDb: number = normalizeResult.dbJobId ?? dbJobId;

    const articleSourceToDbId = new Map<string, number>();
    const videoSourceToDbId = new Map<string, number>();

    // Step 1: 기사 persist
    if (results['naver-news']) {
      const articleItems = (results['naver-news'] as any).items || [];
      const normalized = articleItems.map((a: any) => normalizeNaverArticle(a));
      const persisted = await persistArticles(jobIdForDb, normalized);
      for (const row of persisted) {
        articleSourceToDbId.set(row.sourceId, row.id);
        newArticleIds.push(row.id);
      }
    }

    // Step 2: 영상 persist
    if (results['youtube-videos']) {
      const videoItems = (results['youtube-videos'] as any).items || [];
      const normalized = videoItems.map((v: any) => normalizeYoutubeVideo(v));
      const persisted = await persistVideos(jobIdForDb, normalized);
      for (const row of persisted) {
        videoSourceToDbId.set(row.sourceId, row.id);
        newVideoIds.push(row.id);
      }
    }

    // Step 3: 네이버 댓글 persist
    if (results['naver-comments']) {
      const commentItems = (results['naver-comments'] as any).items || [];
      const normalized = commentItems.map((c: any) => {
        const articleDbId = articleSourceToDbId.get(c.articleSourceId);
        return normalizeNaverComment(c, articleDbId);
      });
      await persistComments(jobIdForDb, normalized);
    }

    // Step 4: 유튜브 댓글 persist
    if (results['youtube-comments']) {
      const commentItems = (results['youtube-comments'] as any).items || [];
      const normalized = commentItems.map((c: any) => {
        const videoDbId = videoSourceToDbId.get(c.videoSourceId);
        return normalizeYoutubeComment(c, videoDbId);
      });
      await persistComments(jobIdForDb, normalized);
    }

    // Step 5: 커뮤니티 게시글+댓글 persist
    for (const communitySource of COMMUNITY_SOURCES) {
      if (!results[communitySource]) continue;

      const postItems = ((results[communitySource] as any).items as CommunityPost[]) || [];
      const normalizedPosts = postItems.map((p: CommunityPost) =>
        normalizeCommunityPost(p, communitySource),
      );
      const persistedPosts = await persistArticles(jobIdForDb, normalizedPosts);
      const communityArticleMap = new Map<string, number>();
      for (const row of persistedPosts) {
        communityArticleMap.set(row.sourceId, row.id);
        newArticleIds.push(row.id);
      }

      const allCommunityComments = postItems.flatMap((p: CommunityPost) =>
        (p.comments || []).map((c) => {
          const articleDbId = communityArticleMap.get(p.sourceId);
          return normalizeCommunityComment(c, communitySource, articleDbId);
        }),
      );
      if (allCommunityComments.length > 0) {
        await persistComments(jobIdForDb, allCommunityComments);
      }
    }

    // Step 6: 동적 소스 (RSS/HTML) persist
    for (const [key, value] of Object.entries(results)) {
      if (!key.startsWith('feed_')) continue;
      const feedResult = value as {
        items: unknown[];
        dataSourceSnapshot: DataSourceSnapshot;
      };
      const snapshot = feedResult.dataSourceSnapshot;
      const normalized = (feedResult.items as any[]).map((item) =>
        normalizeFeedArticle(item, snapshot),
      );
      if (normalized.length > 0) {
        const persisted = await persistArticles(jobIdForDb, normalized);
        for (const row of persisted) newArticleIds.push(row.id);
      }
      try {
        await getDb()
          .update(dataSources)
          .set({ lastCollectedAt: new Date(), updatedAt: new Date() })
          .where(eq(dataSources.id, snapshot.id));
      } catch (err) {
        logger.warn(`[persist] data_sources.lastCollectedAt 갱신 실패 (${snapshot.id}):`, err);
      }
    }
  }

  // TTL 재사용 인덱스 갱신
  if (keywordForLink) {
    try {
      await Promise.all([
        linkArticleKeywords(newArticleIds, keywordForLink),
        linkVideoKeywords(newVideoIds, keywordForLink),
      ]);
    } catch (err) {
      logger.warn('[persist] keyword linkage 실패:', err);
    }
  }

  // Whisper 전사 큐 push
  if (newVideoIds.length > 0 && dbJobId) {
    try {
      const { enqueued } = await enqueueWhisperForTopVideos({
        jobId: dbJobId,
        topN: 100,
      });
      if (enqueued > 0) {
        logger.info(`[whisper] ${enqueued}개 영상 전사 큐에 등록 (dbJobId=${dbJobId})`);
      }
    } catch (err) {
      logger.warn('[whisper] enqueue 실패:', err instanceof Error ? err.message : err);
    }
  }

  // 임베딩 생성
  try {
    const db = getDb();
    const { articleJobs, commentJobs } = await import('../db/schema/collections');
    const articleRows = await db
      .select({ articleId: articleJobs.articleId })
      .from(articleJobs)
      .where(eq(articleJobs.jobId, dbJobId));
    const commentRows = await db
      .select({ commentId: commentJobs.commentId })
      .from(commentJobs)
      .where(eq(commentJobs.jobId, dbJobId));

    const articleIds = articleRows.map((r) => r.articleId);
    const commentIds = commentRows.map((r) => r.commentId);

    await Promise.allSettled([
      articleIds.length > 0 ? persistArticleEmbeddings(articleIds) : Promise.resolve(),
      commentIds.length > 0 ? persistCommentEmbeddings(commentIds) : Promise.resolve(),
    ]);
    logger.info(
      `[persist] 임베딩 생성 완료 (기사=${articleIds.length}, 댓글=${commentIds.length})`,
    );
  } catch (err) {
    logger.warn(`[persist] 임베딩 생성 스킵:`, err);
  }

  // 최종 상태 업데이트
  await updateJobProgress(dbJobId, {}, 'completed');

  const persistElapsed = ((Date.now() - jobStartTime) / 1000).toFixed(1);
  logger.info(`[persist] 완료: ${persistElapsed}초 소요 (dbJobId=${dbJobId})`);

  // 자동 분석 트리거
  const keyword = job.data.keyword;
  if (keyword) {
    if (dbJobId && (await isPipelineCancelled(dbJobId))) {
      logger.info(`[persist] 취소됨 — classify 트리거 건너뜀 (dbJobId=${dbJobId})`);
    } else {
      await triggerClassify(dbJobId, keyword);
      logger.info(`classify 노드 트리거됨: job=${dbJobId}, keyword=${keyword}`);
    }
  }

  return { persisted: true };
}
```

- [ ] **Step 2: pipeline-worker.ts에서 persist 분기 위임**

`pipeline-worker.ts:362-576` 전체를 다음으로 교체:

```typescript
if (job.name === 'persist') {
  return handlePersist(job, jobStartTime);
}
```

상단 import 추가:

```typescript
import { handlePersist } from './pipeline-worker-persist';
```

이동된 import 제거 — 하단 normalize 분기에서도 사용되는지 grep 후 결정:

- `normalizeNaverArticle/Comment` 등은 normalize 단계에서 호출 안 됨(persist 전용) → 제거 가능. 단, 이 시점에 normalize 분기는 아직 메인 파일에 있으므로 사용처 다시 확인.
- `eq`, `getDb`, `dataSources`, `persistArticles/Videos/Comments`, `linkArticleKeywords/linkVideoKeywords`, `enqueueWhisperForTopVideos`, `COMMUNITY_SOURCES`, `persistArticleEmbeddings/persistCommentEmbeddings`, `updateJobProgress`, `triggerClassify` — persist 전용 → 제거
- `awaitStageGate` — persist에서 옮겼지만 normalize-naver / normalize-youtube에는 없음 → 메인에서 제거 가능

- [ ] **Step 3: 타입체크 + 빌드 + 테스트**

```bash
pnpm -F @ai-signalcraft/core typecheck
pnpm -F @ai-signalcraft/core build
pnpm -F @ai-signalcraft/core test
```

기대: 모두 PASS.

- [ ] **Step 4: 커밋**

```bash
git add packages/core/src/queue/pipeline-worker.ts \
        packages/core/src/queue/pipeline-worker-persist.ts
git commit -m "$(cat <<'EOF'
refactor(core): pipeline-worker persist 핸들러 분리

615줄 거대 핸들러 분해 (2/4) — persist 분기를 별도 파일로 추출.
sourceId→dbId 매핑, keyword linkage, whisper enqueue, embedding,
classify trigger 순서 보존. 외부 시그니처 동일.

리팩토링 마스터플랜 Phase 2 PR 2-F.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: normalize-naver 댓글 수집 분리

**Files:**

- Create: `packages/core/src/queue/pipeline-worker-naver.ts`
- Modify: `packages/core/src/queue/pipeline-worker.ts:79-198`

- [ ] **Step 1: 새 파일 생성 (`pipeline-worker-naver.ts`)**

```typescript
// normalize-naver: 기사 결과에서 URL 추출 후 댓글 병렬 수집 (semaphore CONCURRENCY=4)
import type { Job } from 'bullmq';
import { NaverCommentsCollector } from '@ai-signalcraft/collectors';
import type { NaverComment } from '@ai-signalcraft/collectors';
import { updateJobProgress } from '../pipeline';
import { isPipelineCancelled } from '../pipeline/control';
import { createLogger } from '../utils/logger';

const logger = createLogger('pipeline-worker');

const CONCURRENCY = 4;

export async function collectNaverCommentsForArticles(
  job: Job,
  results: Record<string, unknown>,
): Promise<void> {
  const { dbJobId } = job.data;
  if (!results['naver-news']) return;

  const articles = (results['naver-news'] as { items: Array<{ url: string; title?: string }> })
    .items;
  const maxComments = (job.data.maxComments as number) ?? 500;
  const allComments: NaverComment[] = [];

  // 재사용 기사의 since 맵
  const refetchSpecs = (job.data.reusePlan?.refetchCommentsFor ?? []) as Array<{
    url: string;
    articleId?: number;
    lastCommentsFetchedAt: string | null;
  }>;
  const urlToSince = new Map<string, Date | null>(
    refetchSpecs.map((s) => [
      s.url,
      s.lastCommentsFetchedAt ? new Date(s.lastCommentsFetchedAt) : null,
    ]),
  );

  // 진행 상태 추적
  const articleDetails: Array<{ title: string; status: string; comments: number }> = articles
    .filter((a) => a.url)
    .map((a) => ({ title: (a.title || a.url).slice(0, 50), status: 'pending', comments: 0 }));

  // 네이버뉴스 URL만 필터
  const naverArticles: Array<{ index: number; url: string }> = [];
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    if (!article.url) continue;
    if (!article.url.includes('n.news.naver.com')) {
      articleDetails[i].status = 'completed';
      articleDetails[i].comments = 0;
      continue;
    }
    naverArticles.push({ index: i, url: article.url });
  }

  const updateProgress = async () => {
    if (dbJobId) {
      await updateJobProgress(dbJobId, {
        naver: {
          status: 'running',
          articles: articles.length,
          comments: allComments.length,
          articleDetails,
        },
      });
    }
  };

  const collectArticleComments = async (item: { index: number; url: string }) => {
    const detail = articleDetails[item.index];
    detail.status = 'running';
    const collector = new NaverCommentsCollector();
    const articleComments: NaverComment[] = [];
    const since = urlToSince.get(item.url) ?? undefined;

    try {
      for await (const chunk of collector.collectForArticle(item.url, {
        maxComments,
        since: since ?? undefined,
      })) {
        articleComments.push(...chunk);
        detail.comments = articleComments.length;
        await updateProgress();
      }
      detail.status = 'completed';
    } catch (err) {
      logger.warn(`댓글 수집 실패 (${item.url}):`, err);
      detail.status = 'failed';
    }
    return articleComments;
  };

  // semaphore: CONCURRENCY 배치
  for (let batchStart = 0; batchStart < naverArticles.length; batchStart += CONCURRENCY) {
    if (dbJobId && (await isPipelineCancelled(dbJobId))) {
      logger.info(`[normalize-naver] 댓글 수집 중 취소됨 (${allComments.length}건 수집 후)`);
      break;
    }

    const batch = naverArticles.slice(batchStart, batchStart + CONCURRENCY);
    const batchResults = await Promise.allSettled(batch.map(collectArticleComments));

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        allComments.push(...result.value);
      }
    }

    await job.updateProgress({ commentsCollected: allComments.length });
    await updateProgress();
  }

  if (allComments.length > 0) {
    results['naver-comments'] = {
      source: 'naver-comments',
      items: allComments,
      count: allComments.length,
    };
  }

  // 완료 상태 업데이트
  if (dbJobId) {
    await updateJobProgress(dbJobId, {
      naver: {
        status: 'completed',
        articles: articles.length,
        comments: allComments.length,
        articleDetails,
      },
    });
  }
}
```

- [ ] **Step 2: pipeline-worker.ts에서 normalize-naver 분기 위임**

`pipeline-worker.ts:79-198`(`if (job.name === 'normalize-naver' && results['naver-news']) { ... }` 블록)을 다음으로 교체:

```typescript
if (job.name === 'normalize-naver' && results['naver-news']) {
  await collectNaverCommentsForArticles(job, results);
}
```

상단 import 추가:

```typescript
import { collectNaverCommentsForArticles } from './pipeline-worker-naver';
```

옮긴 import 정리:

- `NaverCommentsCollector` — youtube 분기에서도 안 쓰고 naver 전용 → 메인에서 제거
- `NaverComment` 타입 — naver 전용 → 메인에서 제거

- [ ] **Step 3: 타입체크 + 빌드 + 테스트**

```bash
pnpm -F @ai-signalcraft/core typecheck
pnpm -F @ai-signalcraft/core build
pnpm -F @ai-signalcraft/core test
```

기대: 모두 PASS. `worker.test.ts`의 `collectForArticle`/`normalize-naver` 검사가 메인 파일에서 사라지므로 **이 단계에서 테스트 실패**할 수 있음 → Step 4에서 워커 테스트 갱신.

- [ ] **Step 4: worker.test.ts 갱신 (디렉토리 전체 검색)**

`packages/core/tests/worker.test.ts`의 마지막 `describe` 블록에서 단일 파일 grep을 디렉토리 전체로 변경:

```typescript
import { readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

// ... 기존 코드 위쪽 유지 ...

describe('naver comments pipeline integration', () => {
  it('flows.ts에서 collect-naver-comments가 제거되었다', () => {
    const flowsContent = readFileSync(resolve(__dirname, '../src/queue/flows.ts'), 'utf-8');
    expect(flowsContent).not.toContain("name: 'collect-naver-comments'");
    expect(flowsContent).toContain("name: 'collect-naver-articles'");
  });

  it('pipeline-worker 모듈군에서 normalize-naver 시 collectForArticle을 호출한다', () => {
    const queueDir = resolve(__dirname, '../src/queue');
    const workerFiles = readdirSync(queueDir)
      .filter((f) => f.startsWith('pipeline-worker') && f.endsWith('.ts'))
      .map((f) => readFileSync(join(queueDir, f), 'utf-8'))
      .join('\n');
    expect(workerFiles).toContain('collectForArticle');
    expect(workerFiles).toContain("job.name === 'normalize-naver'");
  });

  it('normalize-naver data에 maxComments가 포함된다', () => {
    const flowsContent = readFileSync(resolve(__dirname, '../src/queue/flows.ts'), 'utf-8');
    expect(flowsContent).toContain('maxComments');
  });
});
```

```bash
pnpm -F @ai-signalcraft/core test
```

기대: PASS.

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/queue/pipeline-worker.ts \
        packages/core/src/queue/pipeline-worker-naver.ts \
        packages/core/tests/worker.test.ts
git commit -m "$(cat <<'EOF'
refactor(core): pipeline-worker normalize-naver 핸들러 분리

615줄 거대 핸들러 분해 (3/4) — 네이버 댓글 병렬 수집(semaphore=4)을
별도 파일로 추출. since 맵 / 부분 실패 허용 / 배치 취소 확인 보존.

worker.test.ts: 단일 파일 grep을 pipeline-worker* 디렉토리 검색으로 갱신.

리팩토링 마스터플랜 Phase 2 PR 2-F.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: normalize-youtube 분기 분리 (신/구 경로)

**Files:**

- Create: `packages/core/src/queue/pipeline-worker-youtube.ts`
- Modify: `packages/core/src/queue/pipeline-worker.ts:201-349`

- [ ] **Step 1: 새 파일 생성 (`pipeline-worker-youtube.ts`)**

```typescript
// normalize-youtube: 일체형 YoutubeCollector 결과 + 레거시 YoutubeVideosCollector 댓글 수집
import type { Job } from 'bullmq';
import { YoutubeCommentsCollector } from '@ai-signalcraft/collectors';
import type { YoutubeComment, YoutubeVideo } from '@ai-signalcraft/collectors';
import { updateJobProgress } from '../pipeline';
import { isPipelineCancelled } from '../pipeline/control';
import { createLogger } from '../utils/logger';

const logger = createLogger('pipeline-worker');

const YT_CONCURRENCY = 3;

/** 신규 경로: YoutubeCollector(일체형)이 영상+댓글을 함께 수집한 결과 분리 */
export async function splitYoutubeUnifiedResult(
  job: Job,
  results: Record<string, unknown>,
): Promise<boolean> {
  const { dbJobId } = job.data;
  if (!results['youtube']) return false;

  const videos = (results['youtube'] as { items: YoutubeVideo[] }).items;
  const allComments: YoutubeComment[] = [];

  for (const video of videos) {
    allComments.push(...(video.comments ?? []));
    video.comments = [];
  }

  results['youtube-videos'] = {
    source: 'youtube-videos',
    items: videos,
    count: videos.length,
  };

  if (allComments.length > 0) {
    results['youtube-comments'] = {
      source: 'youtube-comments',
      items: allComments,
      count: allComments.length,
    };
  }

  if (dbJobId) {
    await updateJobProgress(dbJobId, {
      youtube: {
        status: 'completed',
        videos: videos.length,
        comments: allComments.length,
      },
    });
  }

  return true;
}

/** 레거시 경로: YoutubeVideosCollector 결과에 댓글 후처리 (semaphore=3, since 주입 불필요) */
export async function collectYoutubeCommentsLegacy(
  job: Job,
  results: Record<string, unknown>,
): Promise<void> {
  const { dbJobId } = job.data;
  if (!results['youtube-videos'] || results['youtube']) return;

  const videos = (
    results['youtube-videos'] as { items: Array<{ sourceId: string; title?: string }> }
  ).items;
  const maxComments = (job.data.maxComments as number) ?? 500;
  const allComments: YoutubeComment[] = [];

  const videoDetails: Array<{ title: string; status: string; comments: number }> = videos
    .filter((v) => v.sourceId)
    .map((v) => ({
      title: (v.title || v.sourceId).slice(0, 50),
      status: 'pending',
      comments: 0,
    }));

  const validVideos: Array<{ index: number; sourceId: string }> = [];
  for (let i = 0; i < videos.length; i++) {
    if (videos[i].sourceId) {
      validVideos.push({ index: i, sourceId: videos[i].sourceId });
    }
  }

  const updateYtProgress = async () => {
    if (dbJobId) {
      await updateJobProgress(dbJobId, {
        youtube: {
          status: 'running',
          videos: videos.length,
          comments: allComments.length,
          videoDetails,
        },
      });
    }
  };

  const collectVideoComments = async (item: { index: number; sourceId: string }) => {
    const detail = videoDetails[item.index];
    detail.status = 'running';
    const collector = new YoutubeCommentsCollector();
    const videoComments: YoutubeComment[] = [];

    try {
      for await (const chunk of collector.collect({
        keyword: item.sourceId,
        startDate: job.data.startDate ?? '',
        endDate: job.data.endDate ?? '',
        maxComments,
      })) {
        videoComments.push(...chunk);
        detail.comments = videoComments.length;
        await updateYtProgress();
      }
      detail.status = 'completed';
    } catch (err) {
      logger.warn(
        `[youtube-comments] 영상 댓글 수집 실패 (${item.sourceId}):`,
        err instanceof Error ? err.message : err,
      );
      detail.status = 'failed';
    }
    return videoComments;
  };

  for (let batchStart = 0; batchStart < validVideos.length; batchStart += YT_CONCURRENCY) {
    if (dbJobId && (await isPipelineCancelled(dbJobId))) {
      logger.info(`[normalize-youtube] 댓글 수집 중 취소됨 (${allComments.length}건 수집 후)`);
      break;
    }

    const batch = validVideos.slice(batchStart, batchStart + YT_CONCURRENCY);
    const batchResults = await Promise.allSettled(batch.map(collectVideoComments));

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        allComments.push(...result.value);
      }
    }

    await job.updateProgress({ commentsCollected: allComments.length });
    await updateYtProgress();
  }

  if (allComments.length > 0) {
    results['youtube-comments'] = {
      source: 'youtube-comments',
      items: allComments,
      count: allComments.length,
    };
  }

  if (dbJobId) {
    await updateJobProgress(dbJobId, {
      youtube: {
        status: 'completed',
        videos: videos.length,
        comments: allComments.length,
        videoDetails,
      },
    });
  }
}
```

- [ ] **Step 2: pipeline-worker.ts에서 normalize-youtube 두 분기 위임**

`pipeline-worker.ts:201-349` 의 두 `if (job.name === 'normalize-youtube' ...)` 블록 전체를 다음으로 교체:

```typescript
if (job.name === 'normalize-youtube') {
  const unifiedHandled = await splitYoutubeUnifiedResult(job, results);
  if (!unifiedHandled) {
    await collectYoutubeCommentsLegacy(job, results);
  }
}
```

**주의:** 원본은 두 if를 독립적으로 평가하지만 실제로는 `results['youtube']` 존재 여부로 mutual exclusive. 위 코드는 의미 동일.

상단 import 추가:

```typescript
import { splitYoutubeUnifiedResult, collectYoutubeCommentsLegacy } from './pipeline-worker-youtube';
```

옮긴 import 정리:

- `YoutubeCommentsCollector`, `YoutubeComment`, `YoutubeVideo` — youtube 전용 → 메인에서 제거

- [ ] **Step 3: 타입체크 + 빌드 + 테스트**

```bash
pnpm -F @ai-signalcraft/core typecheck
pnpm -F @ai-signalcraft/core build
pnpm -F @ai-signalcraft/core test
```

기대: 모두 PASS.

- [ ] **Step 4: 커밋**

```bash
git add packages/core/src/queue/pipeline-worker.ts \
        packages/core/src/queue/pipeline-worker-youtube.ts
git commit -m "$(cat <<'EOF'
refactor(core): pipeline-worker normalize-youtube 핸들러 분리

615줄 거대 핸들러 분해 (4/4) — 신규(통합 수집기) / 레거시(영상→댓글 후처리)
두 경로를 별도 파일로 추출. semaphore=3 / since 주입 불필요 동작 보존.

리팩토링 마스터플랜 Phase 2 PR 2-F.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: dispatcher 정리 + 진입 헬퍼 (`pipeline-worker-normalize.ts`)

**근거:** 현재 메인 파일은 normalize 진입(자식 결과 수집, feed/community 분기)과 dispatcher가 섞여 있음. normalize 진입을 별도 헬퍼로 빼면 메인 dispatcher가 ~60줄로 깔끔해진다.

**Files:**

- Create: `packages/core/src/queue/pipeline-worker-normalize.ts`
- Modify: `packages/core/src/queue/pipeline-worker.ts`

- [ ] **Step 1: 새 파일 생성 (`pipeline-worker-normalize.ts`)**

```typescript
// normalize-* 진입점 — 자식(collect) 결과 수집 + naver/youtube/feed/community 위임
import type { Job } from 'bullmq';
import type { DataSourceSnapshot } from '@ai-signalcraft/collectors';
import { isPipelineCancelled } from '../pipeline/control';
import { createLogger } from '../utils/logger';
import { collectNaverCommentsForArticles } from './pipeline-worker-naver';
import { splitYoutubeUnifiedResult, collectYoutubeCommentsLegacy } from './pipeline-worker-youtube';

const logger = createLogger('pipeline-worker');

export async function handleNormalize(job: Job, jobStartTime: number): Promise<unknown> {
  const { source, dbJobId } = job.data;

  // 취소 확인
  if (dbJobId && (await isPipelineCancelled(dbJobId))) {
    logger.info(`[${job.name}] 취소됨 — 정규화 건너뜀`);
    return { skipped: true, reason: 'cancelled' };
  }

  // 자식 작업(collect) 결과 수집
  const childValues = await job.getChildrenValues();
  const results: Record<string, unknown> = {};

  // normalize-feed-*: 동적 소스는 dataSourceSnapshot.id로 키 분리
  if (job.name.startsWith('normalize-feed-')) {
    const snapshot = job.data.dataSourceSnapshot as DataSourceSnapshot;
    for (const value of Object.values(childValues)) {
      const childResult = value as { source: string; items: unknown[]; count: number };
      results[`feed_${snapshot.id}`] = { ...childResult, dataSourceSnapshot: snapshot };
    }
  } else {
    for (const [_key, value] of Object.entries(childValues)) {
      const childResult = value as { source: string; items: unknown[]; count: number };
      results[childResult.source] = childResult;
    }
  }

  // 소스별 분기
  if (job.name === 'normalize-naver' && results['naver-news']) {
    await collectNaverCommentsForArticles(job, results);
  }

  if (job.name === 'normalize-youtube') {
    const unifiedHandled = await splitYoutubeUnifiedResult(job, results);
    if (!unifiedHandled) {
      await collectYoutubeCommentsLegacy(job, results);
    }
  }

  // normalize-community: 커뮤니티 수집기는 게시글+댓글 통합 수집 → 추가 작업 없음
  // results에 각 커뮤니티 소스 결과가 그대로 담김

  const normalizeElapsed = ((Date.now() - jobStartTime) / 1000).toFixed(1);
  logger.info(`[${job.name}] 완료: ${normalizeElapsed}초 소요`);
  return { source, dbJobId, normalized: true, results };
}
```

- [ ] **Step 2: pipeline-worker.ts 메인 dispatcher로 축소**

`packages/core/src/queue/pipeline-worker.ts` 전체를 다음으로 교체:

```typescript
// 파이프라인 Worker 핸들러 — pipeline 큐 dispatcher
import type { Job } from 'bullmq';
import { createLogger } from '../utils/logger';
import { handleNormalize } from './pipeline-worker-normalize';
import { handlePersist } from './pipeline-worker-persist';
import { handleClassify } from './pipeline-worker-classify';

const logger = createLogger('pipeline-worker');

export function createPipelineHandler(): (job: Job) => Promise<unknown> {
  return async (job: Job) => {
    const { dbJobId } = job.data;
    const jobStartTime = Date.now();
    logger.info(`[${job.name}] 시작 (dbJobId=${dbJobId})`);

    if (job.name.startsWith('normalize-')) {
      return handleNormalize(job, jobStartTime);
    }

    if (job.name === 'persist') {
      return handlePersist(job, jobStartTime);
    }

    if (job.name === 'classify') {
      return handleClassify(job);
    }

    // 알 수 없는 job.name — 명시적 미처리 신호
    logger.warn(`[${job.name}] 알 수 없는 job.name (dbJobId=${dbJobId})`);
    return undefined;
  };
}
```

**시그니처 변경:** `Promise<any>` → `Promise<unknown>` (any 제거. BullMQ 측 호환은 동일).

- [ ] **Step 3: worker-process.ts 호출 호환 확인**

```bash
command grep -n "createPipelineHandler" packages/core/src/queue/worker-process.ts
```

기대: `const pipelineWorker = createPipelineWorker(createPipelineHandler());` — 시그니처 동일하므로 변경 불필요.

- [ ] **Step 4: 타입체크 + 빌드 + 테스트**

```bash
pnpm -F @ai-signalcraft/core typecheck
pnpm -F @ai-signalcraft/core build
pnpm -F @ai-signalcraft/core test
```

기대: 모두 PASS. `worker.test.ts`의 `pipeline-worker* 디렉토리 검색`이 새 파일들 모두 포함하므로 통과.

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/queue/pipeline-worker.ts \
        packages/core/src/queue/pipeline-worker-normalize.ts
git commit -m "$(cat <<'EOF'
refactor(core): pipeline-worker dispatcher 정리 + normalize 진입 분리

615줄 → 60줄 dispatcher. normalize 진입(자식 결과 수집 + 소스별 위임)을
pipeline-worker-normalize.ts로 추출. createPipelineHandler 시그니처는
Promise<any> → Promise<unknown>로 타입 강화 (BullMQ 호환 유지).

리팩토링 마스터플랜 Phase 2 PR 2-F 마무리.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: dispatcher 단위 테스트 추가

**근거:** 분해된 헬퍼들 자체는 BullMQ Job / DB / 외부 collector 의존성이 무거워 단위 테스트가 어렵지만, **dispatcher 라우팅**은 모킹으로 검증 가능. 회귀 방지의 첫 단계.

**Files:**

- Create: `packages/core/src/queue/__tests__/pipeline-worker-dispatch.test.ts`

- [ ] **Step 1: 단위 테스트 작성**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';

// vi.mock은 import 전에 호이스팅되므로 const는 참조 불가 → vi.hoisted로 함께 끌어올림
const { handleNormalize, handlePersist, handleClassify } = vi.hoisted(() => ({
  handleNormalize: vi.fn().mockResolvedValue({ normalized: true }),
  handlePersist: vi.fn().mockResolvedValue({ persisted: true }),
  handleClassify: vi.fn().mockResolvedValue({ classified: true }),
}));

vi.mock('../pipeline-worker-normalize', () => ({ handleNormalize }));
vi.mock('../pipeline-worker-persist', () => ({ handlePersist }));
vi.mock('../pipeline-worker-classify', () => ({ handleClassify }));
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  logError: vi.fn(),
}));

const { createPipelineHandler } = await import('../pipeline-worker');

const makeJob = (name: string, data: Record<string, unknown> = {}): Job =>
  ({ name, data: { dbJobId: 1, ...data } }) as unknown as Job;

describe('createPipelineHandler dispatcher', () => {
  beforeEach(() => {
    handleNormalize.mockClear();
    handlePersist.mockClear();
    handleClassify.mockClear();
  });

  it('normalize-naver를 handleNormalize로 라우팅한다', async () => {
    const handler = createPipelineHandler();
    const result = await handler(makeJob('normalize-naver'));
    expect(handleNormalize).toHaveBeenCalledOnce();
    expect(handlePersist).not.toHaveBeenCalled();
    expect(handleClassify).not.toHaveBeenCalled();
    expect(result).toEqual({ normalized: true });
  });

  it('normalize-youtube를 handleNormalize로 라우팅한다', async () => {
    const handler = createPipelineHandler();
    await handler(makeJob('normalize-youtube'));
    expect(handleNormalize).toHaveBeenCalledOnce();
  });

  it('normalize-feed-*를 handleNormalize로 라우팅한다', async () => {
    const handler = createPipelineHandler();
    await handler(makeJob('normalize-feed-uuid-123'));
    expect(handleNormalize).toHaveBeenCalledOnce();
  });

  it('normalize-community를 handleNormalize로 라우팅한다', async () => {
    const handler = createPipelineHandler();
    await handler(makeJob('normalize-community-dcinside'));
    expect(handleNormalize).toHaveBeenCalledOnce();
  });

  it('persist를 handlePersist로 라우팅한다', async () => {
    const handler = createPipelineHandler();
    const result = await handler(makeJob('persist'));
    expect(handlePersist).toHaveBeenCalledOnce();
    expect(handleNormalize).not.toHaveBeenCalled();
    expect(result).toEqual({ persisted: true });
  });

  it('classify를 handleClassify로 라우팅한다', async () => {
    const handler = createPipelineHandler();
    const result = await handler(makeJob('classify'));
    expect(handleClassify).toHaveBeenCalledOnce();
    expect(result).toEqual({ classified: true });
  });

  it('알 수 없는 job.name은 undefined를 반환한다', async () => {
    const handler = createPipelineHandler();
    const result = await handler(makeJob('unknown-stage'));
    expect(handleNormalize).not.toHaveBeenCalled();
    expect(handlePersist).not.toHaveBeenCalled();
    expect(handleClassify).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('jobStartTime을 normalize/persist에 전달한다', async () => {
    const handler = createPipelineHandler();
    await handler(makeJob('persist'));
    const [_job, jobStartTime] = handlePersist.mock.calls[0];
    expect(typeof jobStartTime).toBe('number');
    expect(jobStartTime).toBeLessThanOrEqual(Date.now());
  });
});
```

- [ ] **Step 2: 테스트 실행**

```bash
pnpm -F @ai-signalcraft/core test src/queue/__tests__/pipeline-worker-dispatch.test.ts
```

기대: 8 cases PASS.

- [ ] **Step 3: 전체 테스트 재확인**

```bash
pnpm -F @ai-signalcraft/core test
pnpm -r typecheck
pnpm -r build
```

기대: 모두 PASS.

- [ ] **Step 4: 커밋**

```bash
git add packages/core/src/queue/__tests__/pipeline-worker-dispatch.test.ts
git commit -m "$(cat <<'EOF'
test(core): pipeline-worker dispatcher 라우팅 회귀 테스트 8건

job.name별 라우팅 (normalize-* / persist / classify / unknown) 검증.
헬퍼 모킹으로 dispatcher 책임만 격리. 분해 후 회귀 방지 1차 안전망.

리팩토링 마스터플랜 Phase 2 PR 2-F.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 최종 검증 + PR 준비

- [ ] **Step 1: 최종 라인 수 확인**

```bash
command wc -l packages/core/src/queue/pipeline-worker.ts \
              packages/core/src/queue/pipeline-worker-normalize.ts \
              packages/core/src/queue/pipeline-worker-naver.ts \
              packages/core/src/queue/pipeline-worker-youtube.ts \
              packages/core/src/queue/pipeline-worker-persist.ts \
              packages/core/src/queue/pipeline-worker-classify.ts
```

기대:

- `pipeline-worker.ts`: ~60줄 (dispatcher)
- `pipeline-worker-normalize.ts`: ~55줄
- `pipeline-worker-naver.ts`: ~140줄
- `pipeline-worker-youtube.ts`: ~180줄
- `pipeline-worker-persist.ts`: ~210줄
- `pipeline-worker-classify.ts`: ~50줄
- **합계 ~695줄** (분해 시 import/주석 중복으로 +13% 증가는 정상)

종료 기준: 단일 1000줄 초과 파일 0건. 메인 dispatcher 100줄 미만.

- [ ] **Step 2: 순환 의존 없음 확인**

```bash
pnpm -F @ai-signalcraft/core exec madge --circular src/
```

기대: 기존 1 사이클(`pipeline/control ↔ pipeline-checks`, dynamic import 의도적 회피) 외 신규 사이클 0건.

- [ ] **Step 3: 전체 워크스페이스 빌드/테스트**

```bash
pnpm -r typecheck
pnpm -r build
pnpm -r test
```

기대: 모두 PASS.

- [ ] **Step 4: 정적 grep 검증 (regression 안전망)**

```bash
# 분해 후에도 모든 핵심 동작 키워드가 어딘가에 존재하는지 확인
command grep -rn "collectForArticle" packages/core/src/queue/
command grep -rn "isPipelineCancelled" packages/core/src/queue/pipeline-worker
command grep -rn "awaitStageGate" packages/core/src/queue/pipeline-worker
command grep -rn "enqueueWhisperForTopVideos" packages/core/src/queue/pipeline-worker
command grep -rn "triggerClassify" packages/core/src/queue/pipeline-worker
command grep -rn "triggerAnalysis" packages/core/src/queue/pipeline-worker
command grep -rn "persistArticleEmbeddings" packages/core/src/queue/pipeline-worker
```

기대: 각 키워드 정확히 1개 파일에서 발견 (해당 책임 헬퍼).

- [ ] **Step 5: docs/refactor 진행 상태 갱신**

`docs/refactor/00-master-plan.md` 의 Phase 2 PR 시퀀스에서 PR 2-F를 ✅로 표시. 현 시점에는 plan 문서가 작업 결과의 단일 진실은 아니므로 메모리 갱신만 충분.

대신 메모리 파일 업데이트:

`/home/gon/.claude/projects/-home-gon-projects-ai-ai-signalcraft/memory/project_refactor_master_plan.md` 표에 다음 행 추가:

```markdown
| 2 유지보수성 | 2-F pipeline-worker 분해 (615→60줄 dispatcher + 5 헬퍼) | ✅ |
```

보류 항목에서 PR 2-F 제거.

- [ ] **Step 6: PR 생성**

```bash
git log --oneline main..HEAD
git push -u origin refactor/pr-2f-pipeline-worker
gh pr create --title "refactor(core): pipeline-worker 분해 (615줄 → 60줄 dispatcher + 5 헬퍼)" --body "$(cat <<'EOF'
## Summary
- pipeline-worker.ts (615줄)을 job.name 분기별 헬퍼 5개로 분해
- 외부 시그니처(`createPipelineHandler`), BullMQ job data shape, 로깅 prefix 보존
- dispatcher 라우팅 회귀 테스트 8건 추가

## 분해 결과
| 파일 | 책임 | 줄 수 |
|---|---|---|
| pipeline-worker.ts | dispatcher | ~60 |
| pipeline-worker-normalize.ts | normalize-* 진입 + 위임 | ~55 |
| pipeline-worker-naver.ts | 네이버 댓글 병렬 수집 | ~140 |
| pipeline-worker-youtube.ts | 유튜브 신/구 경로 | ~180 |
| pipeline-worker-persist.ts | DB 영속화 + 임베딩 + 트리거 | ~210 |
| pipeline-worker-classify.ts | item-analysis + analysis 트리거 | ~50 |

## 보존 동작
- 취소 확인 (`isPipelineCancelled`) 호출 위치
- BP 게이트 (`awaitStageGate`)
- 부분 실패 허용 (네이버/유튜브 댓글 개별 실패 → 로깅 후 계속)
- semaphore (네이버=4, 유튜브=3)
- sourceId→dbId 매핑 순서 (기사·영상 먼저 persist → 댓글 FK 연결)
- whisper enqueue / 임베딩 / classify 트리거 순서

## Test plan
- [x] `pnpm -r typecheck`
- [x] `pnpm -r build`
- [x] `pnpm -r test` (워크스페이스 전체)
- [x] dispatcher 라우팅 8 cases PASS
- [x] 정적 grep regression — 핵심 키워드 단일 파일 매치
- [ ] 로컬 docker-compose 1건 분석 수동 통합 테스트 (5 분 시나리오)
- [ ] 운영 배포 후 5분 모니터링 — `dserver logs ais-prod-worker --tail 100`

## 다운타임
워커 재시작 5~10분 (큐 pause → drain → 배포 → resume).

리팩토링 마스터플랜 Phase 2 PR 2-F.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

PR URL을 사용자에게 보고.

---

## Verification (전체)

각 Task 완료 후:

1. `pnpm -F @ai-signalcraft/core typecheck` PASS
2. `pnpm -F @ai-signalcraft/core test` PASS
3. `pnpm -F @ai-signalcraft/core build` PASS

PR 머지 후 (운영 배포 단계):

1. 로컬 docker-compose 5분 시나리오:
   - 새 분석 트리거(50개 한도) → 진행 모니터 → 완료 → 리포트
   - DB의 `collection_jobs.progress`, `analysis_results` 행 패턴 확인
2. 운영 배포 절차 (마스터플랜 § 워커 재시작 절차):
   - Web에서 큐 트리거 일시 차단
   - BullMQ pipeline 큐 pause
   - active job drain (최대 10분)
   - 새 워커 배포 → `recoverOrphanedCollectionJobs`가 stale active 정리
   - 큐 resume + 트리거 재허용
3. 배포 후 5분 모니터링:
   - `dserver logs ais-prod-worker --tail 100`
   - `dserver logs ais-prod-web --tail 100`

## 롤백 절차

PR 단일 revert. 6개 커밋이 한 PR 안에 있으므로 PR revert 한 번으로 615줄 단일 파일로 원복. 디렉토리 노이즈 없음(평탄 패턴).

---

## 함정 체크리스트

| 함정                                                   | 영향                                | 방어                                                                                                                                                                                                                                                             |
| ------------------------------------------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| import 누락                                            | 워커 부팅 시 ReferenceError         | Task 5 Step 4에서 typecheck + build로 검출                                                                                                                                                                                                                       |
| Job data shape 변경                                    | flows.ts와 단절                     | 시그니처 보존 의도적, 테스트로 검증                                                                                                                                                                                                                              |
| 로깅 prefix 누락                                       | 운영 grep 패턴 깨짐                 | 각 헬퍼에서 동일 prefix `[normalize-naver]` 등 사용                                                                                                                                                                                                              |
| persist 순서 변경                                      | sourceId→dbId 매핑 깨짐             | Task 2 Step 1에서 Step 1~6 순서 그대로 보존                                                                                                                                                                                                                      |
| `Promise<any>` → `Promise<unknown>`                    | BullMQ 호환                         | BullMQ는 반환값을 unknown으로 받아 ChildrenValues에 저장 — any와 동일 동작                                                                                                                                                                                       |
| `await import('../db/schema/collections')` 동적 import | persist 헬퍼 안에 그대로 보존       | 변경 없음 (사이클 회피용)                                                                                                                                                                                                                                        |
| dispatcher가 unknown job.name 처리                     | 기존 코드는 fallthrough → undefined | 명시적 logger.warn + return undefined 추가. flows.ts 검수 결과 pipeline 큐에는 `normalize-naver`, `normalize-youtube`, `normalize-community-*`, `normalize-feed-*`, `persist`, `classify` 6종만 보내므로 warn은 운영 시 발생 안 함. 미래 미스라우팅 조기 발견용. |
| `recoverOrphanedCollectionJobs`와 충돌                 | 큐 비어있을 때 호출                 | 마스터플랜 § 워커 재시작 절차 준수                                                                                                                                                                                                                               |
