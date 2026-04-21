// page.content() race condition 재시도 방어 검증.
// 실제 장애(fmkorea run 9db2551f): page.content이 "Unable to retrieve content because
// the page is navigating and changing the content." 로 throw되면 기존 코드는 attempt
// loop 바깥으로 에러가 전파되어 608ms에 죽었다. 수정 후에는 catch → 다음 attempt로 복구.
import { describe, it, expect } from 'vitest';
import type { Page } from 'playwright';
import {
  CommunityBaseCollector,
  type SiteSelectors,
} from '../src/adapters/community-base-collector';
import type { BrowserCollectorConfig } from '../src/adapters/browser-collector';
import type { CommunityPost } from '../src/types/community';

type ContentBehavior = { kind: 'throw'; message: string } | { kind: 'html'; html: string };

function makeFakePage(behaviors: ContentBehavior[]): {
  page: Page;
  calls: { content: number; goto: number };
} {
  const calls = { content: 0, goto: 0 };
  const fake: Partial<Page> = {
    setExtraHTTPHeaders: async () => {},
    goto: (async () => {
      calls.goto++;
      return null;
    }) as unknown as Page['goto'],
    waitForTimeout: async () => {},
    waitForLoadState: (async () => {}) as unknown as Page['waitForLoadState'],
    content: async () => {
      const idx = Math.min(calls.content, behaviors.length - 1);
      calls.content++;
      const b = behaviors[idx];
      if (b.kind === 'throw') throw new Error(b.message);
      return b.html;
    },
  };
  return { page: fake as Page, calls };
}

class TestCollector extends CommunityBaseCollector {
  readonly source = 'test';
  protected readonly baseUrl = 'https://example.test';
  protected readonly config: BrowserCollectorConfig = {
    pageDelay: { min: 0, max: 0 },
    postDelay: { min: 0, max: 0 },
    defaultMaxItems: 10,
    maxSearchPages: 1,
  };
  protected readonly selectors: SiteSelectors = { list: [], content: [], comment: [] };

  protected buildSearchUrl(_kw: string, page: number): string {
    return `https://example.test/search?p=${page}`;
  }

  protected override detectBlocked(html: string): boolean {
    if (!html || html.length < 100) return true;
    return !html.includes('searchResult');
  }

  protected parseSearchResults(html: string) {
    const out: { url: string; title: string; publishedAt?: Date | null }[] = [];
    const re = /<a href="([^"]+)"\s+title="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      out.push({ url: `https://example.test${m[1]}`, title: m[2], publishedAt: null });
    }
    return out;
  }

  protected async fetchPost(
    _page: Page,
    _url: string,
    _title: string,
    _maxComments: number,
  ): Promise<CommunityPost | null> {
    return null;
  }

  public async runLoadSearchPage(page: Page, url: string, pageNum: number) {
    return this.loadSearchPage(page, url, pageNum);
  }
}

const HTML_OK =
  '<html><body><div class="searchResult">' +
  '<a href="/p/1" title="t1"></a><a href="/p/2" title="t2"></a>' +
  '</div></body></html>';

describe('CommunityBaseCollector.loadSearchPage — page.content() race 방어', () => {
  it('첫 attempt에서 page.content()가 throw되면 다음 attempt로 재시도해 성공한다', async () => {
    const fake = makeFakePage([
      {
        kind: 'throw',
        message:
          'page.content: Unable to retrieve content because the page is navigating and changing the content.',
      },
      { kind: 'html', html: HTML_OK },
    ]);
    const c = new TestCollector();
    const result = await c.runLoadSearchPage(fake.page, 'https://example.test/search?p=1', 1);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result?.map((r) => r.title)).toEqual(['t1', 't2']);
    expect(fake.calls.content).toBe(2);
  });

  // 실패 시 sleep(3000*attempt, 5000*attempt) 백오프가 있어 최악 15s 가량 — 테스트 타임아웃 30s.
  it('3회 모두 실패하면 null 반환', async () => {
    const fake = makeFakePage([
      { kind: 'throw', message: 'page.content: navigating' },
      { kind: 'throw', message: 'page.content: navigating' },
      { kind: 'throw', message: 'page.content: navigating' },
    ]);
    const c = new TestCollector();
    const result = await c.runLoadSearchPage(fake.page, 'https://example.test/search?p=1', 1);
    expect(result).toBeNull();
    expect(fake.calls.content).toBe(3);
  }, 30000);

  it('첫 attempt에서 성공하면 재시도 없음', async () => {
    const fake = makeFakePage([{ kind: 'html', html: HTML_OK }]);
    const c = new TestCollector();
    const result = await c.runLoadSearchPage(fake.page, 'https://example.test/search?p=1', 1);
    expect(result).toHaveLength(2);
    expect(fake.calls.content).toBe(1);
  });
});
