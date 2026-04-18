# YouTube 수집기 재설계 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** YouTube 수집기를 다른 소스와 동일한 일체형 패턴으로 재설계하고, 대댓글 완전 수집, 자막 수집, 쿼터 추적 + youtubei.js fallback을 구현한다.

**Architecture:** Data API v3 주력 + youtubei.js fallback 하이브리드. 영상+댓글+자막을 일체형으로 수집하는 `YoutubeCollector`가 기존 `YoutubeVideosCollector`를 대체. 파이프라인 normalize 단계에서 댓글을 분리하여 persist 호환성 유지.

**Tech Stack:** googleapis v144, youtubei.js v17, youtube-transcript v1.3, TypeScript, Zod, BullMQ, Drizzle ORM

**Spec:** `docs/superpowers/specs/2026-04-19-youtube-collector-redesign.md`

---

### Task 1: 의존성 설치 + DB 스키마 확장

**Files:**
- Modify: `packages/collectors/package.json`
- Modify: `packages/core/src/db/schema/collections.ts:140-170` (videos 테이블)

- [ ] **Step 1: 새 패키지 설치**

```bash
pnpm add youtubei.js youtube-transcript -F @ai-signalcraft/collectors
```

- [ ] **Step 2: 설치 확인**

```bash
pnpm ls youtubei.js youtube-transcript --filter @ai-signalcraft/collectors
```

Expected: 두 패키지 모두 목록에 표시

- [ ] **Step 3: DB 스키마에 transcript 컬럼 추가**

`packages/core/src/db/schema/collections.ts`의 videos 테이블에 추가:

```typescript
// videos 테이블 정의 내, commentCount 아래에 추가
    transcript: text('transcript'),
    transcriptLang: text('transcript_lang'),
```

정확한 위치: `commentCount` 필드와 `publishedAt` 필드 사이에 삽입.

```typescript
    commentCount: integer('comment_count'),
    transcript: text('transcript'),
    transcriptLang: text('transcript_lang'),
    publishedAt: timestamp('published_at'),
```

- [ ] **Step 4: DB 스키마 동기화**

```bash
pnpm db:push
```

Expected: `transcript`, `transcript_lang` 컬럼이 videos 테이블에 추가됨. 기존 행은 `null`.

- [ ] **Step 5: 커밋**

```bash
git add packages/collectors/package.json pnpm-lock.yaml packages/core/src/db/schema/collections.ts
git commit -m "chore: YouTube 수집기 재설계 의존성 추가 + DB 스키마 확장

- youtubei.js, youtube-transcript 패키지 추가
- videos 테이블에 transcript, transcript_lang 컬럼 추가

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: CollectionOptions + CollectionStats 타입 확장

**Files:**
- Modify: `packages/collectors/src/adapters/base.ts`

- [ ] **Step 1: CollectionOptionsSchema에 신규 필드 추가**

`packages/collectors/src/adapters/base.ts`의 `CollectionOptionsSchema`에 `reusePlan` 뒤에 추가:

```typescript
  commentOrder: z.enum(['relevance', 'time']).default('relevance').optional(),
  collectTranscript: z.boolean().default(true).optional(),
```

- [ ] **Step 2: CollectionStats에 YouTube 전용 필드 추가**

`packages/collectors/src/adapters/base.ts`의 `CollectionStats` interface에서 `endReason` union에 `'quotaExhausted'` 추가, 그리고 `pageEmptyCount` 뒤에 신규 필드 추가:

```typescript
export interface CollectionStats {
  endReason:
    | 'maxItemsReached'
    | 'consecutiveOldThreshold'
    | 'pageLimitReached'
    | 'pageEmptyOrBlocked'
    | 'noMoreResults'
    | 'completed'
    | 'quotaExhausted';
  lastPage: number;
  perDayCount: Record<string, number>;
  perDayCapSkip?: number;
  preFilterSkip?: number;
  outOfRange?: number;
  pageEmptyCount?: number;
  quotaUsed?: number;
  quotaRemaining?: number;
  usedFallback?: boolean;
}
```

- [ ] **Step 3: 타입 체크**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm exec tsc --noEmit -p packages/collectors/tsconfig.json 2>&1 | head -20
```

Expected: 에러 없음 (기존 코드는 새 optional 필드에 영향 없음)

- [ ] **Step 4: 커밋**

```bash
git add packages/collectors/src/adapters/base.ts
git commit -m "feat: CollectionOptions에 commentOrder/collectTranscript 추가, CollectionStats에 쿼터 필드 추가

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: YoutubeVideo 타입 확장

**Files:**
- Modify: `packages/collectors/src/adapters/youtube-videos.ts`

- [ ] **Step 1: YoutubeVideo 인터페이스에 comments, transcript 필드 추가**

`packages/collectors/src/adapters/youtube-videos.ts`의 `YoutubeVideo` 인터페이스 끝에 추가:

```typescript
export interface YoutubeVideo {
  sourceId: string;
  url: string;
  title: string;
  description: string | null;
  channelId: string;
  channelTitle: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: Date | null;
  rawData: Record<string, unknown>;
  comments: YoutubeComment[];
  transcript: string | null;
  transcriptLang: string | null;
}
```

- [ ] **Step 2: import 추가**

파일 상단에 `YoutubeComment` import 추가:

```typescript
import type { YoutubeComment } from './youtube-comments';
```

- [ ] **Step 3: 기존 YoutubeVideosCollector의 yield 부분에 기본값 추가**

`YoutubeVideosCollector.collect()` 내부 `videoItems.map` 부분에서 객체 리터럴에 추가:

```typescript
          rawData: item as unknown as Record<string, unknown>,
          comments: [],
          transcript: null,
          transcriptLang: null,
```

- [ ] **Step 4: 타입 체크**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm exec tsc --noEmit -p packages/collectors/tsconfig.json 2>&1 | head -20
```

Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add packages/collectors/src/adapters/youtube-videos.ts
git commit -m "feat: YoutubeVideo 타입에 comments, transcript, transcriptLang 필드 추가

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: QuotaTracker 구현

**Files:**
- Create: `packages/collectors/src/utils/youtube-quota.ts`

- [ ] **Step 1: QuotaTracker 클래스 작성**

```typescript
// packages/collectors/src/utils/youtube-quota.ts

const QUOTA_COSTS = {
  'search.list': 100,
  'videos.list': 1,
  'commentThreads.list': 1,
  'comments.list': 1,
} as const;

type QuotaOperation = keyof typeof QUOTA_COSTS;

const DAILY_QUOTA = 10_000;
const DEFAULT_EXHAUSTION_THRESHOLD = 500;

export class QuotaTracker {
  private used = 0;

  track(operation: QuotaOperation, count = 1): void {
    this.used += QUOTA_COSTS[operation] * count;
  }

  isExhausted(threshold = DEFAULT_EXHAUSTION_THRESHOLD): boolean {
    return this.getRemaining() <= threshold;
  }

  getRemaining(): number {
    return Math.max(0, DAILY_QUOTA - this.used);
  }

  getUsed(): number {
    return this.used;
  }

  reset(): void {
    this.used = 0;
  }
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm exec tsc --noEmit -p packages/collectors/tsconfig.json 2>&1 | head -20
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add packages/collectors/src/utils/youtube-quota.ts
git commit -m "feat: YouTube API QuotaTracker 구현 — 유닛 추적 + 소진 감지

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: InnerTube Fallback 클라이언트

**Files:**
- Create: `packages/collectors/src/utils/youtube-innertube.ts`

- [ ] **Step 1: InnerTube 클라이언트 래퍼 작성**

```typescript
// packages/collectors/src/utils/youtube-innertube.ts
import type { Innertube } from 'youtubei.js';

let innertubeClient: Innertube | null = null;

export async function getInnertubeClient(): Promise<Innertube> {
  if (!innertubeClient) {
    const { Innertube: InnertubeClass } = await import('youtubei.js');
    innertubeClient = await InnertubeClass.create({
      lang: 'ko',
      location: 'KR',
    });
  }
  return innertubeClient;
}

export function resetInnertubeClient(): void {
  innertubeClient = null;
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm exec tsc --noEmit -p packages/collectors/tsconfig.json 2>&1 | head -20
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add packages/collectors/src/utils/youtube-innertube.ts
git commit -m "feat: youtubei.js InnerTube 클라이언트 래퍼 — API 쿼터 fallback용

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: 자막 수집 유틸리티

**Files:**
- Create: `packages/collectors/src/utils/youtube-transcript.ts`

- [ ] **Step 1: fetchTranscript 함수 작성**

```typescript
// packages/collectors/src/utils/youtube-transcript.ts
import { YoutubeTranscript } from 'youtube-transcript';

export async function fetchTranscript(
  videoId: string,
): Promise<{ text: string; lang: string } | null> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'ko' });
    if (segments.length > 0) {
      return {
        text: segments.map((s) => s.text).join(' '),
        lang: 'ko',
      };
    }
  } catch {
    // 한국어 자막 없음
  }

  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    if (segments.length > 0) {
      return {
        text: segments.map((s) => s.text).join(' '),
        lang: 'auto',
      };
    }
  } catch {
    // 자막 없음
  }

  return null;
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm exec tsc --noEmit -p packages/collectors/tsconfig.json 2>&1 | head -20
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add packages/collectors/src/utils/youtube-transcript.ts
git commit -m "feat: YouTube 자막 수집 유틸리티 — 한국어 우선 + 기본 언어 fallback

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: YoutubeCollector 통합 수집기 — 핵심 구현

**Files:**
- Create: `packages/collectors/src/adapters/youtube-collector.ts`

이 파일이 전체 재설계의 핵심. 기존 `YoutubeVideosCollector`와 `YoutubeCommentsCollector`의 기능을 통합하고, QuotaTracker + InnerTube fallback + 자막 수집 + CollectionStats를 모두 포함.

- [ ] **Step 1: YoutubeCollector 클래스 작성**

파일 내용이 길므로 핵심 구조만 명시. 실제 구현은 스펙 문서의 Section 4.3~4.6을 참조하여 작성.

```typescript
// packages/collectors/src/adapters/youtube-collector.ts
import { getYoutubeClient } from '../utils/youtube-client';
import { QuotaTracker } from '../utils/youtube-quota';
import { getInnertubeClient } from '../utils/youtube-innertube';
import { fetchTranscript } from '../utils/youtube-transcript';
import { splitIntoDaysKst, KST_OFFSET_MS } from '../utils/community-parser';
import type { Collector, CollectionOptions, CollectionStats } from './base';
import type { YoutubeVideo } from './youtube-videos';
import type { YoutubeComment } from './youtube-comments';

const DEFAULT_MAX_ITEMS = 50;
const SEARCH_PAGE_SIZE = 50;

function kstDayKey(day: Date): string {
  const d = new Date(day.getTime() + KST_OFFSET_MS);
  return d.toISOString().slice(0, 10);
}

function isInKstDay(publishedAt: Date | null, day: Date): boolean {
  if (!publishedAt) return true;
  const expectedKstDay = Math.floor((day.getTime() + KST_OFFSET_MS) / 86400000);
  const actualKstDay = Math.floor((publishedAt.getTime() + KST_OFFSET_MS) / 86400000);
  return actualKstDay === expectedKstDay;
}

export class YoutubeCollector implements Collector<YoutubeVideo> {
  readonly source = 'youtube';

  private quotaTracker = new QuotaTracker();
  private stats: CollectionStats | null = null;
  private usingFallback = false;

  async *collect(options: CollectionOptions): AsyncGenerator<YoutubeVideo[], void, unknown> {
    const youtube = getYoutubeClient();
    if (!youtube) {
      this.usingFallback = true;
    }

    const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS;
    const days = splitIntoDaysKst(options.startDate, options.endDate);
    const perDayLimit = options.maxItemsPerDay ?? Math.max(1, Math.floor(maxItems / days.length));
    const skipUrlSet = new Set(options.reusePlan?.skipUrls ?? []);
    const refetchSet = new Set(options.reusePlan?.refetchCommentsFor ?? []);
    const commentOrder = options.commentOrder ?? 'relevance';
    const collectTranscript = options.collectTranscript ?? true;
    const maxComments = options.maxComments ?? 500;

    const perDayCount: Record<string, number> = {};
    let totalCollected = 0;
    let perDayCapSkip = 0;
    let outOfRange = 0;
    let endReason: CollectionStats['endReason'] = 'noMoreResults';
    const globalSeenIds = new Set<string>();

    for (const day of days) {
      const dayStr = kstDayKey(day);
      perDayCount[dayStr] = 0;
      let collectedThisDay = 0;

      const searchResults = await this.searchVideos(
        options.keyword, day, perDayLimit, skipUrlSet, globalSeenIds,
      );

      for (const video of searchResults) {
        if (!isInKstDay(video.publishedAt, day)) {
          outOfRange++;
          continue;
        }
        if (collectedThisDay >= perDayLimit) {
          perDayCapSkip++;
          continue;
        }

        video.comments = await this.collectComments(video.sourceId, maxComments, commentOrder);

        if (collectTranscript) {
          const result = await fetchTranscript(video.sourceId);
          video.transcript = result?.text ?? null;
          video.transcriptLang = result?.lang ?? null;
        }

        collectedThisDay++;
        totalCollected++;
        perDayCount[dayStr] = collectedThisDay;

        yield [video];

        if (totalCollected >= maxItems) {
          endReason = 'maxItemsReached';
          break;
        }
      }
      if (endReason === 'maxItemsReached') break;
    }

    if (refetchSet.size > 0) {
      yield* this.refetchCommentsOnly(refetchSet, maxComments, commentOrder);
    }

    this.stats = {
      endReason,
      lastPage: -1,
      perDayCount,
      perDayCapSkip,
      outOfRange,
      quotaUsed: this.quotaTracker.getUsed(),
      quotaRemaining: this.quotaTracker.getRemaining(),
      usedFallback: this.usingFallback,
    };
  }

  getLastRunStats(): CollectionStats | null {
    return this.stats;
  }

  // --- API 기반 검색 ---

  private async searchVideos(
    keyword: string,
    day: Date,
    perDayLimit: number,
    skipUrlSet: Set<string>,
    globalSeenIds: Set<string>,
  ): Promise<YoutubeVideo[]> {
    if (this.shouldUseFallback()) {
      return this.searchViaInnertube(keyword, day, perDayLimit, skipUrlSet, globalSeenIds);
    }
    return this.searchViaApi(keyword, day, perDayLimit, skipUrlSet, globalSeenIds);
  }

  private async searchViaApi(
    keyword: string,
    day: Date,
    perDayLimit: number,
    skipUrlSet: Set<string>,
    globalSeenIds: Set<string>,
  ): Promise<YoutubeVideo[]> {
    const youtube = getYoutubeClient()!;
    const publishedAfter = day.toISOString();
    const publishedBefore = new Date(day.getTime() + 86400000 - 1).toISOString();
    const allVideos: YoutubeVideo[] = [];
    let nextPageToken: string | undefined;

    while (allVideos.length < perDayLimit) {
      const remaining = perDayLimit - allVideos.length;
      const pageSize = Math.min(remaining, SEARCH_PAGE_SIZE);

      let searchResponse;
      try {
        searchResponse = await youtube.search.list({
          part: ['id'],
          q: keyword,
          type: ['video'],
          publishedAfter,
          publishedBefore,
          maxResults: pageSize,
          order: 'date',
          regionCode: 'KR',
          relevanceLanguage: 'ko',
          pageToken: nextPageToken,
        });
        this.quotaTracker.track('search.list');
      } catch (err: unknown) {
        const error = err as { code?: number };
        if (error.code === 403) {
          this.usingFallback = true;
          return [
            ...allVideos,
            ...(await this.searchViaInnertube(keyword, day, perDayLimit - allVideos.length, skipUrlSet, globalSeenIds)),
          ];
        }
        throw err;
      }

      const searchItems = searchResponse.data.items;
      if (!searchItems || searchItems.length === 0) break;

      const videoIds = searchItems
        .map((item) => item.id?.videoId)
        .filter((id): id is string => Boolean(id))
        .filter((id) => !globalSeenIds.has(id));
      videoIds.forEach((id) => globalSeenIds.add(id));

      if (videoIds.length === 0) {
        nextPageToken = searchResponse.data.nextPageToken ?? undefined;
        if (!nextPageToken) break;
        continue;
      }

      const videosResponse = await youtube.videos.list({
        part: ['snippet', 'statistics'],
        id: videoIds,
      });
      this.quotaTracker.track('videos.list');

      const videoItems = videosResponse.data.items;
      if (!videoItems || videoItems.length === 0) {
        nextPageToken = searchResponse.data.nextPageToken ?? undefined;
        if (!nextPageToken) break;
        continue;
      }

      for (const item of videoItems) {
        const url = `https://www.youtube.com/watch?v=${item.id}`;
        if (skipUrlSet.has(url)) continue;

        allVideos.push({
          sourceId: item.id ?? '',
          url,
          title: item.snippet?.title ?? '',
          description: item.snippet?.description ?? null,
          channelId: item.snippet?.channelId ?? '',
          channelTitle: item.snippet?.channelTitle ?? '',
          viewCount: parseInt(item.statistics?.viewCount ?? '0', 10),
          likeCount: parseInt(item.statistics?.likeCount ?? '0', 10),
          commentCount: parseInt(item.statistics?.commentCount ?? '0', 10),
          publishedAt: item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : null,
          rawData: item as unknown as Record<string, unknown>,
          comments: [],
          transcript: null,
          transcriptLang: null,
        });
      }

      nextPageToken = searchResponse.data.nextPageToken ?? undefined;
      if (!nextPageToken) break;
    }

    return allVideos;
  }

  // --- InnerTube Fallback 검색 ---

  private async searchViaInnertube(
    keyword: string,
    day: Date,
    limit: number,
    skipUrlSet: Set<string>,
    globalSeenIds: Set<string>,
  ): Promise<YoutubeVideo[]> {
    const innertube = await getInnertubeClient();
    const videos: YoutubeVideo[] = [];

    try {
      const results = await innertube.search(keyword, {
        type: 'video',
        sort_by: 'upload_date',
      });

      for (const item of results.videos) {
        if (videos.length >= limit) break;
        const videoId = item.id;
        if (!videoId || globalSeenIds.has(videoId)) continue;
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        if (skipUrlSet.has(url)) continue;
        globalSeenIds.add(videoId);

        const publishedAt = this.parseInnertubeDate((item as any).published?.text);
        if (publishedAt && !isInKstDay(publishedAt, day)) continue;

        videos.push({
          sourceId: videoId,
          url,
          title: (item as any).title?.text ?? '',
          description: (item as any).description_snippet?.text ?? null,
          channelId: '',
          channelTitle: (item as any).author?.name ?? '',
          viewCount: parseInt((item as any).view_count?.text?.replace(/[^0-9]/g, '') ?? '0', 10) || 0,
          likeCount: 0,
          commentCount: 0,
          publishedAt,
          rawData: {},
          comments: [],
          transcript: null,
          transcriptLang: null,
        });
      }
    } catch (err) {
      console.warn('[youtube-innertube] 검색 실패:', err instanceof Error ? err.message : err);
    }

    return videos;
  }

  // --- 댓글 수집 ---

  private async collectComments(
    videoId: string,
    maxComments: number,
    order: 'relevance' | 'time',
  ): Promise<YoutubeComment[]> {
    if (this.shouldUseFallback()) {
      return this.collectCommentsViaInnertube(videoId, maxComments);
    }
    return this.collectCommentsViaApi(videoId, maxComments, order);
  }

  private async collectCommentsViaApi(
    videoId: string,
    maxComments: number,
    order: 'relevance' | 'time',
  ): Promise<YoutubeComment[]> {
    const youtube = getYoutubeClient()!;
    const comments: YoutubeComment[] = [];
    let nextPageToken: string | undefined;

    while (comments.length < maxComments) {
      try {
        const response = await youtube.commentThreads.list({
          part: ['snippet', 'replies'],
          videoId,
          maxResults: Math.min(maxComments - comments.length, 100),
          order,
          pageToken: nextPageToken,
        });
        this.quotaTracker.track('commentThreads.list');

        const items = response.data.items;
        if (!items || items.length === 0) break;

        for (const thread of items) {
          const top = thread.snippet?.topLevelComment;
          if (top?.snippet) {
            comments.push(this.mapApiComment(top, null, videoId));
          }

          const totalReplies = thread.snippet?.totalReplyCount ?? 0;
          const inlineReplies = thread.replies?.comments ?? [];

          if (totalReplies > 5) {
            const allReplies = await this.fetchAllReplies(top?.id ?? '', videoId);
            comments.push(...allReplies);
          } else {
            for (const reply of inlineReplies) {
              if (!reply.snippet) continue;
              comments.push(this.mapApiComment(reply, top?.id ?? null, videoId));
            }
          }
        }

        nextPageToken = response.data.nextPageToken ?? undefined;
        if (!nextPageToken) break;
      } catch (err: unknown) {
        const error = err as { code?: number };
        if (error.code === 403) {
          if (this.quotaTracker.isExhausted()) {
            this.usingFallback = true;
            const remaining = await this.collectCommentsViaInnertube(videoId, maxComments - comments.length);
            comments.push(...remaining);
          }
          break;
        }
        throw err;
      }
    }

    return comments.slice(0, maxComments);
  }

  private async fetchAllReplies(parentId: string, videoId: string): Promise<YoutubeComment[]> {
    const youtube = getYoutubeClient()!;
    const replies: YoutubeComment[] = [];
    let nextPageToken: string | undefined;

    while (true) {
      try {
        const response = await youtube.comments.list({
          part: ['snippet'],
          parentId,
          maxResults: 100,
          pageToken: nextPageToken,
        });
        this.quotaTracker.track('comments.list');

        const items = response.data.items;
        if (!items || items.length === 0) break;

        for (const reply of items) {
          if (!reply.snippet) continue;
          replies.push(this.mapApiComment(reply, parentId, videoId));
        }

        nextPageToken = response.data.nextPageToken ?? undefined;
        if (!nextPageToken) break;
      } catch {
        break;
      }
    }

    return replies;
  }

  private mapApiComment(item: any, parentId: string | null, videoId: string): YoutubeComment {
    const snippet = item.snippet;
    return {
      sourceId: item.id ?? '',
      parentId,
      videoSourceId: videoId,
      content: snippet?.textDisplay ?? snippet?.textOriginal ?? '',
      author: snippet?.authorDisplayName ?? '',
      likeCount: snippet?.likeCount ?? 0,
      publishedAt: snippet?.publishedAt ? new Date(snippet.publishedAt) : null,
      rawData: item as Record<string, unknown>,
    };
  }

  // --- InnerTube Fallback 댓글 ---

  private async collectCommentsViaInnertube(
    videoId: string,
    maxComments: number,
  ): Promise<YoutubeComment[]> {
    const innertube = await getInnertubeClient();
    const comments: YoutubeComment[] = [];

    try {
      const thread = await innertube.getComments(videoId);

      const processComments = (items: any[]) => {
        for (const comment of items) {
          if (comments.length >= maxComments) return;
          comments.push({
            sourceId: comment.comment_id ?? '',
            parentId: null,
            videoSourceId: videoId,
            content: comment.content?.text ?? '',
            author: comment.author?.name ?? '',
            likeCount: parseInt(comment.vote_count?.text?.replace(/[^0-9]/g, '') ?? '0', 10) || 0,
            publishedAt: this.parseInnertubeDate(comment.published?.text),
            rawData: {},
          });
        }
      };

      processComments(thread.contents ?? []);

      let continuation = thread;
      while (comments.length < maxComments && continuation.has_continuation) {
        continuation = await continuation.getContinuation();
        processComments(continuation.contents ?? []);
      }
    } catch {
      // 댓글 비활성화 등
    }

    return comments.slice(0, maxComments);
  }

  // --- refetchCommentsFor 처리 ---

  private async *refetchCommentsOnly(
    refetchSet: Set<string>,
    maxComments: number,
    commentOrder: 'relevance' | 'time',
  ): AsyncGenerator<YoutubeVideo[], void, unknown> {
    for (const url of refetchSet) {
      const videoIdMatch = url.match(/[?&]v=([^&]+)/);
      if (!videoIdMatch) continue;
      const videoId = videoIdMatch[1];

      const comments = await this.collectComments(videoId, maxComments, commentOrder);

      yield [{
        sourceId: videoId,
        url,
        title: '',
        description: null,
        channelId: '',
        channelTitle: '',
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        publishedAt: null,
        rawData: {},
        comments,
        transcript: null,
        transcriptLang: null,
      }];
    }
  }

  // --- 유틸리티 ---

  private shouldUseFallback(): boolean {
    if (this.usingFallback) return true;
    if (this.quotaTracker.isExhausted()) {
      this.usingFallback = true;
      console.warn(
        `[youtube] API 쿼터 임계치 도달 (${this.quotaTracker.getUsed()}유닛 사용) — youtubei.js로 전환`,
      );
      return true;
    }
    return false;
  }

  private parseInnertubeDate(text?: string | null): Date | null {
    if (!text) return null;
    const match = text.match(/(\d+)\s*(시간|분|일|주|개월|년)\s*전/);
    if (match) {
      const now = new Date();
      const amount = parseInt(match[1], 10);
      const unit = match[2];
      if (unit === '시간') now.setHours(now.getHours() - amount);
      else if (unit === '분') now.setMinutes(now.getMinutes() - amount);
      else if (unit === '일') now.setDate(now.getDate() - amount);
      else if (unit === '주') now.setDate(now.getDate() - amount * 7);
      else if (unit === '개월') now.setMonth(now.getMonth() - amount);
      else if (unit === '년') now.setFullYear(now.getFullYear() - amount);
      return now;
    }
    const parsed = new Date(text);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm exec tsc --noEmit -p packages/collectors/tsconfig.json 2>&1 | head -30
```

Expected: 에러 없음. youtubei.js 타입이 정확히 맞지 않으면 `as any` 캐스트로 해결 (InnerTube 내부 타입은 버전마다 변동).

- [ ] **Step 3: 커밋**

```bash
git add packages/collectors/src/adapters/youtube-collector.ts
git commit -m "feat: YoutubeCollector 통합 수집기 — 영상+댓글+자막 일체형

- Data API v3 주력 + youtubei.js 자동 fallback
- 대댓글 완전 수집 (totalReplyCount > 5 시 comments.list 추가)
- 댓글 정렬 선택 (relevance/time)
- 자막 수집 (한국어 우선)
- CollectionStats 완전 구현
- refetchCommentsFor 댓글 재수집 지원

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: 수집기 레지스트리 + export 등록

**Files:**
- Modify: `packages/collectors/src/adapters/index.ts`
- Modify: `packages/core/src/queue/worker-config.ts`

- [ ] **Step 1: adapters/index.ts에 YoutubeCollector export 추가**

`packages/collectors/src/adapters/index.ts`에 추가:

```typescript
export { YoutubeCollector } from './youtube-collector';
```

- [ ] **Step 2: worker-config.ts에서 수집기 등록 변경**

`packages/core/src/queue/worker-config.ts`의 import 부분에 `YoutubeCollector` 추가:

```typescript
import {
  NaverNewsCollector,
  NaverCommentsCollector,
  YoutubeVideosCollector,
  YoutubeCommentsCollector,
  YoutubeCollector,
  DCInsideCollector,
  FMKoreaCollector,
  ClienCollector,
  registerCollector,
} from '@ai-signalcraft/collectors';
```

`registerAllCollectors()` 함수에서 기존 `YoutubeVideosCollector` 대신 `YoutubeCollector` 등록:

```typescript
export function registerAllCollectors(): void {
  registerCollector(new NaverNewsCollector());
  registerCollector(new NaverCommentsCollector());
  registerCollector(new YoutubeCollector());
  registerCollector(new YoutubeCommentsCollector());
  registerCollector(new DCInsideCollector());
  registerCollector(new FMKoreaCollector());
  registerCollector(new ClienCollector());
}
```

- [ ] **Step 3: worker-config.ts의 countBySourceType에 'youtube' 소스 추가**

`countBySourceType` 함수에서:

```typescript
export function countBySourceType(source: string, items: unknown[]): Record<string, number> {
  const count = items.length;
  if (source === 'naver-news') return { articles: count, comments: 0 };
  if (source === 'youtube') {
    const totalComments = items.reduce<number>(
      (sum, item: any) => sum + (item?.comments?.length ?? 0),
      0,
    );
    return { videos: count, comments: totalComments };
  }
  if (source === 'youtube-videos') return { videos: count, comments: 0 };
  if (source === 'youtube-comments') return { comments: count };
  // ... 나머지 동일
```

- [ ] **Step 4: progressKey에 'youtube' 소스 추가**

`progressKey` 함수에서:

```typescript
export function progressKey(source: string, dataSourceId?: string): string {
  if (dataSourceId) return `ds_${dataSourceId.slice(0, 8)}`;
  if (source === 'naver-news') return 'naver';
  if (source === 'youtube' || source === 'youtube-videos' || source === 'youtube-comments') return 'youtube';
  return source;
}
```

- [ ] **Step 5: 타입 체크**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm exec tsc --noEmit 2>&1 | head -30
```

Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add packages/collectors/src/adapters/index.ts packages/core/src/queue/worker-config.ts
git commit -m "feat: YoutubeCollector 등록 — 레지스트리 + export + progress 매핑

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: flows.ts 변경 — 소스명 전환 + 옵션 전달

**Files:**
- Modify: `packages/core/src/queue/flows.ts:280-311`

- [ ] **Step 1: YouTube flow 변경**

`packages/core/src/queue/flows.ts`의 YouTube flow 부분(라인 280-311)을 교체:

**변경 전:**
```typescript
  if (enabledSources.includes('youtube')) {
    const reusePlan = videoReusePlans['youtube']
      ? toReusePlanPayload(videoReusePlans['youtube'])
      : undefined;
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
            maxItems: effective.youtubeVideos,
            maxItemsPerDay: perDayLimits?.youtubeVideos,
            flowId,
            dbJobId,
            reusePlan,
          },
        },
      ],
    });
  }
```

**변경 후:**
```typescript
  if (enabledSources.includes('youtube')) {
    const reusePlan = videoReusePlans['youtube']
      ? toReusePlanPayload(videoReusePlans['youtube'])
      : undefined;
    children.push({
      name: 'normalize-youtube',
      queueName: 'pipeline',
      data: {
        source: 'youtube',
        flowId,
        dbJobId,
        startDate: params.startDate,
        endDate: params.endDate,
      },
      children: [
        {
          name: 'collect-youtube',
          queueName: 'collectors',
          data: {
            ...params,
            source: 'youtube',
            maxItems: effective.youtubeVideos,
            maxItemsPerDay: perDayLimits?.youtubeVideos,
            maxComments: limits.commentsPerItem,
            commentOrder: 'relevance',
            collectTranscript: true,
            flowId,
            dbJobId,
            reusePlan,
          },
        },
      ],
    });
  }
```

- [ ] **Step 2: 타입 체크**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm exec tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add packages/core/src/queue/flows.ts
git commit -m "feat: YouTube flow 소스명 youtube-videos → youtube 전환 + 댓글/자막 옵션 전달

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: pipeline-worker.ts 변경 — normalize 단계 댓글 수집 제거

**Files:**
- Modify: `packages/core/src/queue/pipeline-worker.ts:178-289`

- [ ] **Step 1: normalize-youtube 블록 교체**

`packages/core/src/queue/pipeline-worker.ts`의 라인 178-289 (기존 댓글 병렬 수집 로직)을 다음으로 교체:

```typescript
      // normalize-youtube: 일체형 수집기가 영상+댓글을 함께 반환
      if (job.name === 'normalize-youtube' && results['youtube']) {
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
      }

      // 하위 호환: 기존 youtube-videos 소스로 수집된 결과도 처리
      if (job.name === 'normalize-youtube' && results['youtube-videos'] && !results['youtube']) {
        // 기존 YoutubeVideosCollector에서 수집한 결과 — 댓글 별도 수집
        const videos = (
          results['youtube-videos'] as { items: Array<{ sourceId: string; title?: string }> }
        ).items;
        // ... 기존 댓글 병렬 수집 로직 유지 (하위 호환)
      }
```

주의: 하위 호환 블록은 기존 `results['youtube-videos']` 키로 수집된 결과가 들어올 때를 위해 기존 로직을 그대로 유지. 실제로는 flows.ts 변경으로 더 이상 이 경로로 진입하지 않지만, 진행 중인 작업이 있을 수 있으므로 안전하게 유지.

- [ ] **Step 2: import에 YoutubeVideo 타입 추가**

`pipeline-worker.ts` 상단 import에 `YoutubeVideo` 타입 추가:

```typescript
import type { YoutubeVideo } from '@ai-signalcraft/collectors';
```

(기존에 `YoutubeCommentsCollector`와 `YoutubeComment` import가 이미 있으므로 같은 import 블록에 추가)

- [ ] **Step 3: 타입 체크**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm exec tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add packages/core/src/queue/pipeline-worker.ts
git commit -m "refactor: normalize-youtube 단계를 일체형 댓글 분리로 전환 + 하위 호환 유지

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 11: normalize.ts + persist.ts — transcript 매핑

**Files:**
- Modify: `packages/core/src/pipeline/normalize.ts:84-99`
- Modify: `packages/core/src/pipeline/persist.ts` (persistVideos upsert set)

- [ ] **Step 1: normalizeYoutubeVideo에 transcript 매핑 추가**

`packages/core/src/pipeline/normalize.ts`의 `normalizeYoutubeVideo` 함수:

```typescript
export function normalizeYoutubeVideo(video: YoutubeVideo): typeof videos.$inferInsert {
  return {
    source: 'youtube',
    sourceId: video.sourceId,
    url: video.url,
    title: video.title,
    description: video.description,
    channelId: video.channelId,
    channelTitle: video.channelTitle,
    viewCount: video.viewCount,
    likeCount: video.likeCount,
    commentCount: video.commentCount,
    publishedAt: toDate(video.publishedAt),
    rawData: video.rawData,
    transcript: video.transcript ?? null,
    transcriptLang: video.transcriptLang ?? null,
  };
}
```

- [ ] **Step 2: persistVideos upsert에 transcript 포함**

`packages/core/src/pipeline/persist.ts`의 `persistVideos` 함수에서 `onConflictDoUpdate`의 `set`에 추가:

```typescript
        set: {
          viewCount: sql`excluded.view_count`,
          likeCount: sql`excluded.like_count`,
          commentCount: sql`excluded.comment_count`,
          rawData: sql`excluded.raw_data`,
          collectedAt: sql`excluded.collected_at`,
          lastFetchedAt: sql`now()`,
          transcript: sql`excluded.transcript`,
          transcriptLang: sql`excluded.transcript_lang`,
        },
```

- [ ] **Step 3: 타입 체크**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm exec tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add packages/core/src/pipeline/normalize.ts packages/core/src/pipeline/persist.ts
git commit -m "feat: YouTube 정규화/저장에 transcript 매핑 추가

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 12: collector-worker.ts — stats 쿼터 로깅

**Files:**
- Modify: `packages/core/src/queue/collector-worker.ts`

- [ ] **Step 1: stats 로깅에 쿼터 정보 추가**

`packages/core/src/queue/collector-worker.ts`에서 stats를 appendJobEvent로 기록하는 부분을 찾아 쿼터 정보 추가:

기존 stats 로깅 코드 뒤에 쿼터 정보 보강:

```typescript
    const stats = collector.getLastRunStats?.();
    if (stats && dbJobId) {
      const quotaInfo = stats.quotaUsed != null
        ? ` quota=${stats.quotaUsed}/${stats.quotaUsed + (stats.quotaRemaining ?? 0)}`
        : '';
      const fallbackInfo = stats.usedFallback ? ' [innertube-fallback]' : '';
      await appendJobEvent(
        dbJobId,
        'info',
        `[${source}] 종료: reason=${stats.endReason}${quotaInfo}${fallbackInfo} 분포=${JSON.stringify(stats.perDayCount)}`,
      );
    }
```

주의: 기존에 이 패턴이 이미 있다면 확장만 하고, 없다면 collect 종료 후 추가.

- [ ] **Step 2: 타입 체크**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm exec tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add packages/core/src/queue/collector-worker.ts
git commit -m "feat: 수집 완료 stats에 YouTube 쿼터 사용량 + fallback 로깅 추가

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 13: 전체 빌드 + 통합 검증

**Files:** (수정 없음 — 검증만)

- [ ] **Step 1: 전체 lint**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm lint 2>&1 | tail -20
```

Expected: 에러 없음

- [ ] **Step 2: 전체 타입 체크**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm exec tsc --noEmit 2>&1 | tail -20
```

Expected: 에러 없음

- [ ] **Step 3: 전체 빌드**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm build 2>&1 | tail -20
```

Expected: 빌드 성공

- [ ] **Step 4: 테스트 (있다면)**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm test 2>&1 | tail -30
```

Expected: 기존 테스트 통과

- [ ] **Step 5: lint/format 오류 수정 후 최종 커밋**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm format
git add -A
git commit -m "chore: YouTube 수집기 재설계 lint/format 정리

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 파일 변경 요약

### 신규 파일 (4개)
| 파일 | Task | 설명 |
|------|------|------|
| `packages/collectors/src/adapters/youtube-collector.ts` | 7 | 통합 수집기 (핵심) |
| `packages/collectors/src/utils/youtube-quota.ts` | 4 | QuotaTracker |
| `packages/collectors/src/utils/youtube-innertube.ts` | 5 | youtubei.js 래퍼 |
| `packages/collectors/src/utils/youtube-transcript.ts` | 6 | 자막 수집 유틸 |

### 수정 파일 (10개)
| 파일 | Task | 변경 |
|------|------|------|
| `packages/collectors/package.json` | 1 | 의존성 추가 |
| `packages/collectors/src/adapters/base.ts` | 2 | Options/Stats 타입 확장 |
| `packages/collectors/src/adapters/youtube-videos.ts` | 3 | YoutubeVideo 타입 확장 |
| `packages/collectors/src/adapters/index.ts` | 8 | YoutubeCollector export |
| `packages/core/src/db/schema/collections.ts` | 1 | videos 테이블 스키마 |
| `packages/core/src/queue/worker-config.ts` | 8 | 수집기 등록 + progress 매핑 |
| `packages/core/src/queue/flows.ts` | 9 | YouTube flow 소스명 전환 |
| `packages/core/src/queue/pipeline-worker.ts` | 10 | normalize 단계 교체 |
| `packages/core/src/pipeline/normalize.ts` | 11 | transcript 매핑 |
| `packages/core/src/pipeline/persist.ts` | 11 | transcript upsert |
| `packages/core/src/queue/collector-worker.ts` | 12 | stats 쿼터 로깅 |

### 의존성 순서 (Task 간)
```
Task 1 (의존성+스키마)
  → Task 2 (타입 확장)
    → Task 3 (YoutubeVideo 타입)
      → Task 4 (QuotaTracker)
      → Task 5 (InnerTube)
      → Task 6 (Transcript)
        → Task 7 (YoutubeCollector — Task 3,4,5,6 모두 필요)
          → Task 8 (레지스트리 등록)
          → Task 9 (flows.ts)
          → Task 10 (pipeline-worker)
          → Task 11 (normalize+persist)
          → Task 12 (collector-worker stats)
            → Task 13 (통합 검증)
```
