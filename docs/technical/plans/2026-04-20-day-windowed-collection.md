# DC/Clien 일자 윈도우 수집 구현 Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DC/Clien 수집에 일자 윈도우 + perDay cap 균등 분배 신규 경로 추가, 일일 증분(자동)/백필(수동) 모드 분리.

**Architecture:** `community-base-collector.ts`에 `sortedByDateDescending()` 플래그 + `collectByDayWindowDescending` 신규 메서드 추가. doCollect 분기에 우선순위 추가 (`supportsDateRangeSearch` → `sortedByDateDescending` → legacy). `CollectionJobData`에 `mode` + `windowDays` 필드 추가, scheduler는 `mode='incremental'` 고정, tRPC `backfill` mutation 신규.

**Tech Stack:** TypeScript, Vitest, BullMQ, Drizzle ORM, tRPC v11, Zod

**Spec:** `docs/technical/specs/2026-04-20-day-windowed-collection-design.md`

---

## File Structure

**Modify:**

- `packages/collectors/src/adapters/base.ts` — `CollectionOptionsSchema`에 `mode` 필드, `CollectionStats.endReason`에 `'maxPagesReached'` enum 추가
- `packages/collectors/src/adapters/community-base-collector.ts` — `sortedByDateDescending()` 메서드, doCollect 분기, `collectByDayWindowDescending` 신규
- `packages/collectors/src/adapters/dcinside.ts` — `sortedByDateDescending = true` override
- `packages/collectors/src/adapters/clien.ts` — `sortedByDateDescending = true` override
- `apps/collector/src/queue/types.ts` — `CollectionJobData`에 `mode`, `windowDays` 추가
- `apps/collector/src/queue/executor.ts` — mode 별 perDay/maxPages 기본값, collector에 mode 전달
- `apps/collector/src/scheduler/scanner.ts` — enqueue 시 `mode: 'incremental'` 명시
- `apps/collector/src/server/trpc/subscriptions.ts` — `backfill` mutation 신규

**Create:**

- `packages/collectors/src/__tests__/day-window-collector.test.ts` — 알고리즘 단위 테스트

---

## Task 1: CollectionOptions/Stats 타입 확장

**Files:**

- Modify: `packages/collectors/src/adapters/base.ts:3-26, 44-72`

- [ ] **Step 1: `mode` 필드를 `CollectionOptionsSchema`에 추가**

`packages/collectors/src/adapters/base.ts` 14번째 줄(`maxItemsPerDay` 위) 직전에 추가:

```ts
  /**
   * 수집 모드. dayWindow 경로 결정 외에 어댑터 동작을 바꾸지 않음.
   * 'incremental': 매일/매시간 자동 수집 (좁은 윈도우, 낮은 cap)
   * 'backfill':    수동 트리거의 과거 백필 (큰 윈도우, 높은 cap)
   * 미지정: 기존 경로(legacy/range) 유지 — backward compatible
   */
  mode: z.enum(['incremental', 'backfill']).optional(),
```

- [ ] **Step 2: `CollectionStats.endReason`에 `'maxPagesReached'` 추가**

`packages/collectors/src/adapters/base.ts` 50번째 줄 부근의 `endReason` 유니언에 한 줄 추가 (`'pageLimitReached'` 다음):

```ts
  endReason:
    | 'maxItemsReached'
    | 'consecutiveOldThreshold'
    | 'pageLimitReached'
    | 'maxPagesReached'
    | 'pageEmptyOrBlocked'
    | 'noMoreResults'
    | 'completed'
    | 'quotaExhausted';
```

- [ ] **Step 3: 타입 체크**

Run: `pnpm --filter @ai-signalcraft/collectors tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
git add packages/collectors/src/adapters/base.ts
git commit -m "feat(collectors): CollectionOptions에 mode 필드 + endReason maxPagesReached 추가"
```

---

## Task 2: 일자 윈도우 알고리즘 단위 테스트 (Red)

**Files:**

- Create: `packages/collectors/src/__tests__/day-window-collector.test.ts`

- [ ] **Step 1: 실패하는 테스트 파일 작성**

알고리즘 검증을 위해 최소 mock 어댑터를 만들고 link 시퀀스(단조감소)에 대해 perDay cap, 일자 점프, consecutiveOld 임계 동작을 검증한다.

```ts
// packages/collectors/src/__tests__/day-window-collector.test.ts
import { describe, it, expect } from 'vitest';
import { CommunityBaseCollector, type SiteSelectors } from '../adapters/community-base-collector';
import type { BrowserCollectorConfig } from '../adapters/browser-collector';
import type { CommunityPost } from '../types/community';
import type { Page } from 'playwright';

type FakeLink = { url: string; title: string; publishedAt: Date };

function kstDate(yyyymmdd: string, hhmm = '12:00'): Date {
  // KST = UTC+9. 2026-04-20 12:00 KST → 2026-04-20T03:00Z
  return new Date(`${yyyymmdd}T${hhmm}:00+09:00`);
}

class FakeDayWindowCollector extends CommunityBaseCollector {
  readonly source = 'fake';
  protected readonly baseUrl = 'https://example.test';
  protected readonly config: BrowserCollectorConfig = {
    pageDelay: { min: 0, max: 0 },
    postDelay: { min: 0, max: 0 },
    defaultMaxItems: 1000,
    maxSearchPages: 100,
  };
  protected readonly selectors: SiteSelectors = { list: [], content: [], comment: [] };

  protected override sortedByDateDescending(): boolean {
    return true;
  }

  // pages: 페이지 번호(1-base)별 link 시퀀스. 빈 배열이면 결과 없음.
  constructor(private readonly pages: FakeLink[][]) {
    super();
  }

  protected buildSearchUrl(_kw: string, page: number): string {
    return `https://example.test/search?p=${page}`;
  }

  protected parseSearchResults(_html: string) {
    return [];
  }

  // loadSearchPage override: Playwright 우회, 사전 정의된 pages 반환
  protected override async loadSearchPage(_page: Page, _searchUrl: string, pageNum: number) {
    const pageLinks = this.pages[pageNum - 1];
    if (!pageLinks) return [];
    return pageLinks.map((l) => ({ url: l.url, title: l.title, publishedAt: l.publishedAt }));
  }

  protected async fetchPost(
    _page: Page,
    url: string,
    title: string,
    _maxComments: number,
  ): Promise<CommunityPost | null> {
    const link = this.pages.flat().find((l) => l.url === url);
    if (!link) return null;
    return {
      sourceId: url,
      url,
      title,
      content: title,
      author: 'tester',
      boardName: 'fake',
      publishedAt: link.publishedAt,
      viewCount: 0,
      commentCount: 0,
      likeCount: 0,
      rawData: {},
      comments: [],
    };
  }
}

async function collectAll(c: FakeDayWindowCollector, options: Parameters<typeof c.collect>[0]) {
  const out: CommunityPost[] = [];
  for await (const chunk of c.collect(options)) out.push(...chunk);
  return out;
}

describe('collectByDayWindowDescending', () => {
  it('perDay cap을 절대 초과하지 않는다', async () => {
    // 한 페이지에 2026-04-20 글 5건 (모두 동일 일자)
    const links: FakeLink[] = Array.from({ length: 5 }, (_, i) => ({
      url: `https://example.test/${i}`,
      title: `t${i}`,
      publishedAt: kstDate('2026-04-20', `12:0${i}`),
    }));
    const c = new FakeDayWindowCollector([links]);
    const posts = await collectAll(c, {
      keyword: 'test',
      startDate: '2026-04-20T00:00:00+09:00',
      endDate: '2026-04-20T00:00:00+09:00',
      maxItems: 1000,
      maxItemsPerDay: 3,
      mode: 'incremental',
    });
    expect(posts).toHaveLength(3);
  });

  it('publishedAt이 윈도우보다 오래되면 다음 일자로 점프한다', async () => {
    // 페이지 1: 2026-04-20 글 2건 + 2026-04-19 글 2건
    const page1: FakeLink[] = [
      { url: 'a', title: 'a', publishedAt: kstDate('2026-04-20', '15:00') },
      { url: 'b', title: 'b', publishedAt: kstDate('2026-04-20', '10:00') },
      { url: 'c', title: 'c', publishedAt: kstDate('2026-04-19', '20:00') },
      { url: 'd', title: 'd', publishedAt: kstDate('2026-04-19', '10:00') },
    ];
    const c = new FakeDayWindowCollector([page1]);
    const posts = await collectAll(c, {
      keyword: 'test',
      startDate: '2026-04-19T00:00:00+09:00',
      endDate: '2026-04-20T00:00:00+09:00',
      maxItems: 1000,
      maxItemsPerDay: 10,
      mode: 'backfill',
    });
    expect(posts).toHaveLength(4);
  });

  it('윈도우 외 글은 수집하지 않는다', async () => {
    // 사용자 윈도우: 2026-04-20만. 페이지에 04-19 글이 섞여 있어도 무시.
    const page1: FakeLink[] = [
      { url: 'a', title: 'a', publishedAt: kstDate('2026-04-20', '12:00') },
      { url: 'b', title: 'b', publishedAt: kstDate('2026-04-19', '12:00') },
    ];
    const c = new FakeDayWindowCollector([page1]);
    const posts = await collectAll(c, {
      keyword: 'test',
      startDate: '2026-04-20T00:00:00+09:00',
      endDate: '2026-04-20T00:00:00+09:00',
      maxItems: 1000,
      maxItemsPerDay: 10,
      mode: 'incremental',
    });
    expect(posts.map((p) => p.url)).toEqual(['a']);
  });

  it('consecutiveOld 임계 도달 시 다음 일자로 점프 후 수집 계속', async () => {
    // 사용자 윈도우: [04-19, 04-20] 2일.
    // 페이지에 04-20 글 1건 + 04-18 이전 글 35건 + 04-19 글 1건이 순서대로 등장하면
    // 04-18 이전이 30건 연속이므로 dayIdx → 04-19로 점프, 그래도 같은 페이지에서
    // 마지막 04-19 글은 새 윈도우 안에 들어와 수집되어야 한다.
    const old: FakeLink[] = Array.from({ length: 35 }, (_, i) => ({
      url: `old${i}`,
      title: `old${i}`,
      publishedAt: kstDate('2026-04-15', '12:00'),
    }));
    const page1: FakeLink[] = [
      { url: 'today', title: 'today', publishedAt: kstDate('2026-04-20', '12:00') },
      ...old,
      { url: 'yesterday', title: 'yesterday', publishedAt: kstDate('2026-04-19', '23:00') },
    ];
    const c = new FakeDayWindowCollector([page1]);
    const posts = await collectAll(c, {
      keyword: 'test',
      startDate: '2026-04-19T00:00:00+09:00',
      endDate: '2026-04-20T00:00:00+09:00',
      maxItems: 1000,
      maxItemsPerDay: 10,
      mode: 'backfill',
    });
    expect(posts.map((p) => p.url).sort()).toEqual(['today', 'yesterday']);
  });

  it('mode 미지정 시 legacy 경로로 폴백 (sortedByDateDescending=false 어댑터와 동일 동작)', async () => {
    // sortedByDateDescending=true이지만 mode가 없으면 dayWindow 경로로 가도 무방.
    // 핵심은 perDay cap이 maxItemsPerDay 명시되면 항상 적용된다는 것.
    const page1: FakeLink[] = [
      { url: 'a', title: 'a', publishedAt: kstDate('2026-04-20', '12:00') },
      { url: 'b', title: 'b', publishedAt: kstDate('2026-04-20', '11:00') },
    ];
    const c = new FakeDayWindowCollector([page1]);
    const posts = await collectAll(c, {
      keyword: 'test',
      startDate: '2026-04-20T00:00:00+09:00',
      endDate: '2026-04-20T00:00:00+09:00',
      maxItems: 1000,
      // mode 미지정 + maxItemsPerDay 미지정 → cap 비활성, 둘 다 수집
    });
    expect(posts).toHaveLength(2);
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `pnpm --filter @ai-signalcraft/collectors test day-window-collector`
Expected: FAIL — `sortedByDateDescending` 또는 `collectByDayWindowDescending` 미정의로 5개 모두 실패

- [ ] **Step 3: Commit (red)**

```bash
git add packages/collectors/src/__tests__/day-window-collector.test.ts
git commit -m "test(collectors): 일자 윈도우 수집 알고리즘 실패 테스트 추가"
```

---

## Task 3: `sortedByDateDescending` 플래그 + 분기 추가

**Files:**

- Modify: `packages/collectors/src/adapters/community-base-collector.ts:42-110`

- [ ] **Step 1: `sortedByDateDescending()` 메서드 추가 + `doCollect` 분기 한 줄 추가**

`supportsDateRangeSearch()` 메서드(40-49 라인 부근) 바로 아래에 다음을 추가:

```ts
  /**
   * 사이트 검색이 "최신순 정렬은 되지만 날짜 범위 파라미터는 없는" 경우 표시.
   * (DC인사이드, Clien) — true면 클라이언트측 일자 윈도우로 perDay 균등 분배.
   * supportsDateRangeSearch()가 true인 사이트가 우선이며, 둘 다 false면 legacy 경로.
   */
  protected sortedByDateDescending(): boolean {
    return false;
  }
```

`doCollect` 메서드 안 `if (this.supportsDateRangeSearch())` 블록 다음(약 100번째 줄)에 다음 블록 추가:

```ts
if (this.sortedByDateDescending()) {
  yield *
    this.collectByDayWindowDescending(page, options, {
      maxItems,
      maxComments,
      skipUrlSet,
      refetchCommentsOnlySet,
      isInDateRange,
      startTs,
    });
  return;
}
```

- [ ] **Step 2: 타입 체크 (collectByDayWindowDescending 미구현으로 실패 예상)**

Run: `pnpm --filter @ai-signalcraft/collectors tsc --noEmit`
Expected: FAIL — `collectByDayWindowDescending` 미정의

이 단계에서는 컴파일 에러가 정상이며, 다음 task에서 메서드를 구현한다.

---

## Task 4: `collectByDayWindowDescending` 구현 (Green)

**Files:**

- Modify: `packages/collectors/src/adapters/community-base-collector.ts` (Task 3에서 추가한 분기 바로 아래에 신규 메서드 삽입)

- [ ] **Step 1: 신규 private 메서드 구현**

`collectLegacySequential` 메서드 정의 직전에 다음을 추가:

```ts
  /**
   * sortedByDateDescending() = true인 사이트(DC/Clien)용 일자 윈도우 수집.
   *
   * 검색이 단조감소(최신→과거)로 정렬돼 있다는 사실을 활용해 클라이언트측에서
   * KST 자정 기준 일자 배열로 분할하고, 각 일자에 perDayLimit까지만 채운다.
   * dayIdx는 단조 증가(과거 방향)만 허용 — 부족분 보충 금지.
   *
   * ⚠️ 검색 정렬이 깨지면 일자 점프가 부정확해져 누락 발생 가능 →
   *    sortedByDateDescending()을 false로 강등하면 즉시 legacy 경로로 회귀.
   */
  private async *collectByDayWindowDescending(
    page: Page,
    options: CollectionOptions,
    ctx: {
      maxItems: number;
      maxComments: number;
      skipUrlSet: Set<string>;
      refetchCommentsOnlySet: Set<string>;
      isInDateRange: (d: Date | null | undefined) => boolean;
      startTs: number;
    },
  ): AsyncGenerator<CommunityPost[], void, unknown> {
    const days = splitIntoDaysKst(options.startDate, options.endDate);
    // days는 과거→미래 순서로 반환되므로, 최신 우선 처리를 위해 역순 사용
    const daysDescMs = days.map((d) => kstDayStartMs(d)).sort((a, b) => b - a);
    const perDayLimit = options.maxItemsPerDay ?? Number.MAX_SAFE_INTEGER;

    let pageNum = 1;
    let dayIdx = 0;
    const perDayCount = new Map<number, number>();
    const enforced = new Map<number, number>();
    const globalSeen = new Set<string>();
    let consecutiveOldInWindow = 0;
    const CONSECUTIVE_OLD_THRESHOLD = 30;
    let consecutiveEmptyPages = 0;
    const MAX_CONSECUTIVE_EMPTY_PAGES = 5;
    let totalCollected = 0;
    let skippedCount = 0;
    let preFilterSkipCount = 0;
    let perDayCapSkipCount = 0;
    let outOfRangeCount = 0;
    let pageEmptyCount = 0;
    let endReason: CollectionStats['endReason'] = 'completed';
    let lastPageReached = 0;

    const dayKey = (d: Date): number => kstDayStartMs(d);

    pageLoop: while (
      pageNum <= this.config.maxSearchPages &&
      dayIdx < daysDescMs.length &&
      totalCollected < ctx.maxItems
    ) {
      lastPageReached = pageNum;
      const searchUrl = this.buildSearchUrl(options.keyword, pageNum);
      const postLinks = await this.loadSearchPage(page, searchUrl, pageNum);

      if (!postLinks || postLinks.length === 0) {
        consecutiveEmptyPages++;
        pageEmptyCount++;
        if (consecutiveEmptyPages >= MAX_CONSECUTIVE_EMPTY_PAGES) {
          endReason = 'pageEmptyOrBlocked';
          break;
        }
        const backoffMs = 10000 * Math.pow(2, consecutiveEmptyPages - 1);
        console.info(
          `${this.source} 페이지 ${pageNum} 빈/차단 — ${Math.round(backoffMs / 1000)}s 백오프 후 다음 페이지 시도 (${consecutiveEmptyPages}/${MAX_CONSECUTIVE_EMPTY_PAGES})`,
        );
        await sleep(backoffMs, backoffMs + 3000);
        pageNum++;
        continue;
      }
      consecutiveEmptyPages = 0;

      const posts: CommunityPost[] = [];

      for (const link of postLinks) {
        if (totalCollected >= ctx.maxItems) {
          endReason = 'maxItemsReached';
          break pageLoop;
        }
        if (globalSeen.has(link.url)) continue;
        globalSeen.add(link.url);
        if (ctx.skipUrlSet.has(link.url)) {
          skippedCount++;
          continue;
        }

        // publishedAt 파싱 실패: 보수적 fetch (현재 윈도우로 가정)
        if (!link.publishedAt) {
          if (dayIdx >= daysDescMs.length) break;
          const windowStart = daysDescMs[dayIdx];
          if ((perDayCount.get(windowStart) ?? 0) >= perDayLimit) {
            perDayCapSkipCount++;
            continue;
          }
          try {
            const post = await this.fetchPost(page, link.url, link.title, ctx.maxComments);
            if (post) {
              if (!ctx.isInDateRange(post.publishedAt)) {
                outOfRangeCount++;
                continue;
              }
              const pk = post.publishedAt ? dayKey(post.publishedAt as Date) : windowStart;
              perDayCount.set(pk, (perDayCount.get(pk) ?? 0) + 1);
              posts.push(post);
              totalCollected++;
            }
          } catch (err) {
            console.warn(`${this.source} 게시글 수집 실패 (${link.url}):`, err);
          }
          await sleep(this.config.postDelay.min, this.config.postDelay.max);
          continue;
        }

        // classify(link.publishedAt): dayIdx를 필요 시 진행시키며 분기
        const linkTs = link.publishedAt.getTime();
        let classified = false;
        while (!classified && dayIdx < daysDescMs.length) {
          const windowStart = daysDescMs[dayIdx];
          const windowEnd = windowStart + 86400000;

          if (linkTs >= windowEnd) {
            // 더 미래 (이미 처리한 일자) → skip, dayIdx 그대로
            preFilterSkipCount++;
            classified = true;
          } else if (linkTs >= windowStart) {
            // 현재 윈도우 내
            consecutiveOldInWindow = 0;
            if ((perDayCount.get(windowStart) ?? 0) >= perDayLimit) {
              perDayCapSkipCount++;
              classified = true;
              break;
            }
            try {
              const post = await this.fetchPost(page, link.url, link.title, ctx.maxComments);
              if (post) {
                if (!ctx.isInDateRange(post.publishedAt)) {
                  outOfRangeCount++;
                } else if (post.publishedAt) {
                  const pk = dayKey(post.publishedAt as Date);
                  if ((perDayCount.get(pk) ?? 0) >= perDayLimit) {
                    perDayCapSkipCount++;
                  } else {
                    perDayCount.set(pk, (perDayCount.get(pk) ?? 0) + 1);
                    posts.push(post);
                    totalCollected++;
                  }
                }
              }
            } catch (err) {
              console.warn(`${this.source} 게시글 수집 실패 (${link.url}):`, err);
            }
            await sleep(this.config.postDelay.min, this.config.postDelay.max);
            classified = true;
          } else {
            // linkTs < windowStart → 더 오래된 글
            consecutiveOldInWindow++;
            if (consecutiveOldInWindow >= CONSECUTIVE_OLD_THRESHOLD) {
              dayIdx++;
              consecutiveOldInWindow = 0;
              // 같은 link를 새 윈도우에서 재평가 (loop 계속)
              continue;
            }
            preFilterSkipCount++;
            classified = true;
          }
        }
      }

      const filtered = this.enforcePerDayCap(posts, dayKey, perDayLimit, enforced);
      if (filtered.length > 0) yield filtered;
      await sleep(this.config.pageDelay.min, this.config.pageDelay.max);

      if (pageNum === this.config.maxSearchPages) {
        endReason = 'maxPagesReached';
      }
      pageNum++;
    }

    if (dayIdx >= daysDescMs.length && endReason === 'completed') {
      // 모든 일자 처리 완료
    }

    this.logCollectionEnd(skippedCount, outOfRangeCount, preFilterSkipCount);

    const dist: Record<string, number> = {};
    for (const [k, v] of perDayCount.entries()) {
      const kstStr = new Date(k + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
      dist[kstStr] = v;
    }
    this.lastRunStats = {
      endReason,
      lastPage: lastPageReached,
      perDayCount: dist,
      perDayCapSkip: perDayCapSkipCount,
      preFilterSkip: preFilterSkipCount,
      outOfRange: outOfRangeCount,
      pageEmptyCount,
    };
    console.info(
      `${this.source} 종료(dayWindow): total=${totalCollected} lastPage=${lastPageReached} reason=${endReason} dayCount(KST)=${JSON.stringify(dist)} perDayCapSkip=${perDayCapSkipCount} preFilterSkip=${preFilterSkipCount} outOfRange=${outOfRangeCount}`,
    );
  }
```

- [ ] **Step 2: 타입 체크 통과 확인**

Run: `pnpm --filter @ai-signalcraft/collectors tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 단위 테스트 실행 — Task 2의 5개 케이스 모두 통과**

Run: `pnpm --filter @ai-signalcraft/collectors test day-window-collector`
Expected: PASS (5 passed)

- [ ] **Step 4: 기존 테스트 회귀 확인**

Run: `pnpm --filter @ai-signalcraft/collectors test`
Expected: 전체 PASS (기존 fmkorea/dcinside/clien 회귀 없음)

- [ ] **Step 5: Commit**

```bash
git add packages/collectors/src/adapters/community-base-collector.ts
git commit -m "feat(collectors): collectByDayWindowDescending 신규 경로 추가"
```

---

## Task 5: DC/Clien 어댑터에 플래그 활성화

**Files:**

- Modify: `packages/collectors/src/adapters/dcinside.ts:30-34` 부근
- Modify: `packages/collectors/src/adapters/clien.ts` (selectors 정의 부근)

- [ ] **Step 1: dcinside.ts에 한 줄 override 추가**

`packages/collectors/src/adapters/dcinside.ts`의 `selectors` 정의 직후(34번째 줄 부근)에 다음 추가:

```ts
  protected override sortedByDateDescending(): boolean {
    return true;
  }
```

- [ ] **Step 2: clien.ts에 동일하게 추가**

`packages/collectors/src/adapters/clien.ts`의 `selectors` 정의 직후에 동일한 override 추가:

```ts
  protected override sortedByDateDescending(): boolean {
    return true;
  }
```

- [ ] **Step 3: 타입 체크 + 테스트**

Run: `pnpm --filter @ai-signalcraft/collectors tsc --noEmit && pnpm --filter @ai-signalcraft/collectors test`
Expected: 모두 PASS

- [ ] **Step 4: Commit**

```bash
git add packages/collectors/src/adapters/dcinside.ts packages/collectors/src/adapters/clien.ts
git commit -m "feat(collectors): dcinside/clien sortedByDateDescending=true 활성화"
```

---

## Task 6: CollectionJobData에 mode/windowDays 추가

**Files:**

- Modify: `apps/collector/src/queue/types.ts:29-53`

- [ ] **Step 1: `CollectionJobData` 인터페이스에 옵셔널 필드 추가**

`triggerType` 다음 줄(48번째 줄 부근)에 다음 필드를 추가:

```ts
  /**
   * 수집 모드 — DC/Clien의 일자 윈도우 분기 결정.
   * 'incremental': scheduler 자동 (perDay=50, maxPages=20, windowDays=1)
   * 'backfill':    수동 트리거 (perDay=200, maxPages=80, windowDays=사용자 입력)
   * 미지정 시 기존 동작(legacy) 유지 — backward compatible.
   */
  mode?: 'incremental' | 'backfill';
  /** backfill 모드에서 사용자가 지정한 백필 기간(일). incremental은 항상 1. */
  windowDays?: number;
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm --filter @ai-signalcraft/collector tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add apps/collector/src/queue/types.ts
git commit -m "feat(collector): CollectionJobData에 mode/windowDays 필드 추가"
```

---

## Task 7: executor가 mode를 collector로 전달

**Files:**

- Modify: `apps/collector/src/queue/executor.ts:78-89`

- [ ] **Step 1: `collector.collect()` 호출 시 `mode` 전달**

`apps/collector/src/queue/executor.ts`에서 `collector.collect({...})` 블록(약 78-89번째 줄)에 `mode`를 추가:

```ts
const iter = collector.collect({
  keyword,
  startDate: dateRange.startISO,
  endDate: dateRange.endISO,
  maxItems: limits.maxPerRun,
  maxItemsPerDay: limits.maxPerRun,
  maxComments: limits.commentsPerItem,
  collectTranscript: options?.collectTranscript,
  mode: data.mode, // ⚠️ dayWindow 분기에 사용 (DC/Clien 한정 동작 영향)
});
```

(같은 함수 시그니처 위에서 `data` 변수를 구조분해 중이라면 `mode`도 함께 꺼내야 함. 현재 코드에서 `data: CollectionJobData`를 그대로 받아 필드 접근하는 패턴이므로 `data.mode`로 직접 참조.)

- [ ] **Step 2: 타입 체크**

Run: `pnpm --filter @ai-signalcraft/collector tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add apps/collector/src/queue/executor.ts
git commit -m "feat(collector): executor가 mode를 collector.collect로 전달"
```

---

## Task 8: scheduler가 incremental mode 명시

**Files:**

- Modify: `apps/collector/src/scheduler/scanner.ts:74-88`

- [ ] **Step 1: `enqueueCollectionJob` 호출에 `mode: 'incremental'` 추가**

`apps/collector/src/scheduler/scanner.ts`의 `enqueueCollectionJob({...})` 호출(74-86번째 줄 부근) 끝에 다음 두 필드 추가:

```ts
await enqueueCollectionJob({
  runId,
  subscriptionId: sub.id,
  source,
  keyword: sub.keyword,
  limits: sub.limits,
  options: sub.options ?? undefined,
  dateRange: { startISO, endISO },
  triggerType: 'schedule',
  mode: 'incremental',
  windowDays: 1,
});
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm --filter @ai-signalcraft/collector tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add apps/collector/src/scheduler/scanner.ts
git commit -m "feat(scheduler): 자동 enqueue 시 mode=incremental 명시"
```

---

## Task 9: tRPC `backfill` mutation 신규

**Files:**

- Modify: `apps/collector/src/server/trpc/subscriptions.ts` (`triggerNow` 직후에 신규 procedure 추가)

- [ ] **Step 1: `backfill` mutation 추가**

`triggerNow` mutation 정의(약 154번째 줄~) 끝의 콤마 다음에 다음 procedure 추가:

```ts
  backfill: protectedProcedure
    .input(
      z.object({
        subscriptionId: z.number().int().positive(),
        fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD KST 형식'),
        toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD KST 형식'),
        perDay: z.number().int().positive().max(1000).default(200),
        maxPages: z.number().int().positive().max(200).default(80),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // windowDays 검증: 90일 이내
      const fromMs = new Date(`${input.fromDate}T00:00:00+09:00`).getTime();
      const toMs = new Date(`${input.toDate}T00:00:00+09:00`).getTime();
      const windowDays = Math.floor((toMs - fromMs) / 86400000) + 1;
      if (windowDays < 1 || windowDays > 90) {
        throw new Error(`windowDays는 1~90 범위여야 합니다 (입력: ${windowDays})`);
      }

      const sub = await ctx.db.query.keywordSubscriptions.findFirst({
        where: (t, { eq }) => eq(t.id, input.subscriptionId),
      });
      if (!sub) throw new Error(`subscription ${input.subscriptionId} not found`);

      const runId = randomUUID();
      const startISO = new Date(fromMs).toISOString();
      const endISO = new Date(toMs + 86400000).toISOString(); // toDate의 KST 자정 + 24h

      for (const source of sub.sources as CollectorSource[]) {
        await enqueueCollectionJob({
          runId,
          subscriptionId: sub.id,
          source,
          keyword: sub.keyword,
          limits: { ...sub.limits, maxPerRun: input.perDay },
          options: sub.options ?? undefined,
          dateRange: { startISO, endISO },
          triggerType: 'manual',
          mode: 'backfill',
          windowDays,
        });
      }

      return { runId, windowDays, sources: sub.sources };
    }),
```

파일 상단 import 섹션에 `randomUUID`가 이미 있는지 확인하고, 없으면 다음을 추가:

```ts
import { randomUUID } from 'node:crypto';
import { enqueueCollectionJob } from '../../queue/queues';
import type { CollectorSource } from '../../queue/types';
```

(import 경로는 파일 위치에 맞춰 조정 — `triggerNow`가 이미 사용 중이라면 동일 경로 재사용)

- [ ] **Step 2: 타입 체크**

Run: `pnpm --filter @ai-signalcraft/collector tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add apps/collector/src/server/trpc/subscriptions.ts
git commit -m "feat(trpc): subscriptions.backfill mutation 추가"
```

---

## Task 10: 통합 검증 (sub/37 dev 환경)

**Files:** 없음 (수동 검증)

- [ ] **Step 1: collector 워커 재시작 + tRPC 호출 시뮬레이션**

dev 환경에서 다음을 확인:

```bash
# 1) 워커가 새 코드로 동작하는지 확인 (apps/collector dev 모드 재시작)
pnpm --filter @ai-signalcraft/collector dev

# 2) 별도 터미널에서 tRPC backfill 호출 (예시 — 실제 호출은 web 또는 curl)
# subscriptionId=37, fromDate=2026-04-13, toDate=2026-04-19, perDay=200
```

- [ ] **Step 2: collection_runs 일자 분포 확인**

DB에서:

```sql
SELECT date_trunc('day', published_at AT TIME ZONE 'Asia/Seoul') AS kst_day,
       source, COUNT(*)
FROM raw_items
WHERE fetched_from_run = '<백필run_id>' AND source IN ('dcinside','clien')
GROUP BY 1,2 ORDER BY 1 DESC;
```

기대: 각 일자가 균등하게 perDay(=200) 부근까지 채워짐 (현재 한 날짜 쏠림 → 7일 균등 분포로 전환).

- [ ] **Step 3: scheduler가 일일 증분으로만 동작하는지 확인**

자동 enqueue 후 collection_runs에서 `trigger_type='schedule'` + 옵션상 windowDays=1, perDay=50 (limits.maxPerRun)으로 처리되는지 워커 stdout 로그 확인:

```
dcinside 종료(dayWindow): ... reason=completed dayCount(KST)={"2026-04-20":50}
```

- [ ] **Step 4: 회귀 테스트 풀세트 실행**

Run: `pnpm test`
Expected: 모든 패키지 PASS

- [ ] **Step 5: Commit (검증 완료 표식)**

수동 검증이라 코드 변경은 없지만, 결과를 spec 문서에 후속 노트로 추가:

```bash
# (선택) docs/technical/specs/2026-04-20-day-windowed-collection-design.md 끝에
# "## 7. 검증 결과" 섹션을 짧게 추가
git add docs/technical/specs/2026-04-20-day-windowed-collection-design.md
git commit -m "docs: 일자 윈도우 수집 통합 검증 결과 기록"
```

(검증이 실패하면 commit 대신 디버깅 → 회귀)

---

## Self-Review

- **Spec coverage**: 1) DC/Clien dayWindow 경로(Task 3-5), 2) incremental/backfill 분리(Task 6-9), 3) 기존 fmkorea/네이버 무영향(Task 4 Step 4 회귀), 4) DB 스키마 무변경(전 Task 확인) — 모두 커버.
- **Placeholder scan**: TBD/TODO 없음. 모든 step에 실제 코드/명령 포함.
- **Type consistency**: `sortedByDateDescending`, `collectByDayWindowDescending`, `mode`, `windowDays` — 모든 task에서 동일 명명 일관 유지. `CollectionStats.endReason`에 `'maxPagesReached'` 추가됨(Task 1) → Task 4에서 사용됨.
- **검증된 가정**: `splitIntoDaysKst`, `kstDayStartMs`, `enforcePerDayCap` 모두 기존 코드에 존재(`community-base-collector.ts` 5번째 줄 import 및 403번째 줄 정의 확인 완료).

---

## Execution Handoff

Plan complete and saved to `docs/technical/plans/2026-04-20-day-windowed-collection.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
