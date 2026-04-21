// packages/collectors/tests/day-window-collector.test.ts
// Red step: sortedByDateDescending()는 Task 3에서 CommunityBaseCollector에 추가 예정.
// 현재 미존재 메서드 override이므로 @ts-expect-error로 컴파일 통과시키되, 런타임 동작은 미구현.
import { describe, it, expect } from 'vitest';
import type { Page } from 'playwright';
import {
  CommunityBaseCollector,
  type SiteSelectors,
} from '../src/adapters/community-base-collector';
import type { BrowserCollectorConfig } from '../src/adapters/browser-collector';
import type { CommunityPost } from '../src/types/community';

type FakeLink = { url: string; title: string; publishedAt: Date };

function kstDate(yyyymmdd: string, hhmm = '12:00'): Date {
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

  // @ts-expect-error -- sortedByDateDescending()는 Task 3에서 추가 예정 (현재 CommunityBaseCollector에 미존재)
  protected override sortedByDateDescending(): boolean {
    return true;
  }

  constructor(private readonly pages: FakeLink[][]) {
    super();
  }

  protected buildSearchUrl(_kw: string, page: number): string {
    return `https://example.test/search?p=${page}`;
  }

  protected parseSearchResults(_html: string) {
    return [];
  }

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
    const links: FakeLink[] = Array.from({ length: 5 }, (_, i) => ({
      url: `https://example.test/${i}`,
      title: `t${i}`,
      publishedAt: kstDate('2026-04-20', `12:${String(i).padStart(2, '0')}`),
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

  it('윈도우 내 두 날짜의 게시글을 모두 수집한다', async () => {
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
    // 35 > CONSECUTIVE_OLD_THRESHOLD(30) — 다음 일자 점프 유도
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

  it('시작 일자에 글이 없고 검색 결과 최신 글이 더 과거의 수집 윈도우에 속할 때 수집한다', async () => {
    // 실제 장애 재현: 클리앙 "정원오" 구독에서 nextRunAt=오늘, 검색 결과 최신이 2일 전인 경우.
    // start=04-14, end=04-21 → daysDescMs=[04-21..04-14]. 검색 결과 첫 글은 04-19.
    // 기존 로직: dayIdx=0(04-21)에서 한 칸만 전진 확인 → 04-19 < 04-20 → consecutiveOld carry.
    //         30개 쌓여야 dayIdx++ 되고, 그마저도 1칸씩 → 04-19 윈도우까지 도달 못해 전부 skip.
    // 개선 로직: 링크 publishedAt 기준으로 dayIdx를 즉시 해당 일자로 점프.
    const page1: FakeLink[] = [
      { url: 'u19', title: 't19', publishedAt: kstDate('2026-04-19', '11:14') },
      { url: 'u18', title: 't18', publishedAt: kstDate('2026-04-18', '10:15') },
      { url: 'u17', title: 't17', publishedAt: kstDate('2026-04-17', '12:26') },
    ];
    const c = new FakeDayWindowCollector([page1]);
    const posts = await collectAll(c, {
      keyword: 'test',
      startDate: '2026-04-14T00:00:00+09:00',
      endDate: '2026-04-21T00:00:00+09:00',
      maxItems: 1000,
      maxItemsPerDay: 100,
      mode: 'incremental',
    });
    expect(posts.map((p) => p.url).sort()).toEqual(['u17', 'u18', 'u19']);
  });

  it('모든 검색 결과가 수집 범위 이전일 때는 0건이면서 빠르게 종료 (무한 페이지 방지)', async () => {
    // daysDescMs=[04-21..04-14] (8일). 검색 결과가 전부 04-01 근방이면 carry만 누적되다가
    // CONSECUTIVE_OLD_THRESHOLD 도달 시 dayIdx를 끝까지 전진시켜 pageLoop 탈출해야 한다.
    const page1: FakeLink[] = Array.from({ length: 35 }, (_, i) => ({
      url: `u${i}`,
      title: `t${i}`,
      publishedAt: kstDate('2026-04-01', `12:${String(i % 60).padStart(2, '0')}`),
    }));
    const c = new FakeDayWindowCollector([page1, page1, page1]); // 여러 페이지 제공
    const posts = await collectAll(c, {
      keyword: 'test',
      startDate: '2026-04-14T00:00:00+09:00',
      endDate: '2026-04-21T00:00:00+09:00',
      maxItems: 1000,
      maxItemsPerDay: 100,
      mode: 'incremental',
    });
    expect(posts).toHaveLength(0);
    // 두 번째 페이지를 fetchPost 하러 가지 않았음을 확인하려면 카운트를 추가할 수도 있지만
    // 최소한 무한 루프/과도한 시간은 걸리지 않아야 한다. (vitest timeout은 기본 5s)
  });

  it('mode 미지정 시 legacy 경로로 폴백 (sortedByDateDescending=true 어댑터의 backward compat)', async () => {
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
    });
    expect(posts).toHaveLength(2);
  });
});
