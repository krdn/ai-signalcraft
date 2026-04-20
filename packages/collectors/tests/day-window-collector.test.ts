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
