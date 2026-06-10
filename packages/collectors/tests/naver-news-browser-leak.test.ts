// Playwright 폴백 브라우저 누수 회귀 테스트
// fetch 연속 실패로 폴백이 켜질 때 동시 태스크가 각자 launchBrowser()를 호출해
// 마지막 할당 외의 브라우저가 close되지 않고 chromium 고아 프로세스로 남는 버그 재현.
//
// ⚠️ 레이스 재현은 naver-news.ts 내부 상수에 의존:
//   ARTICLE_CONCURRENCY=5, FETCH_FAIL_THRESHOLD=5, BATCH_SIZE=10
//   (1차 웨이브 5건 전부 fetch 실패 → 2차 웨이브 5건이 동시에 폴백 진입)
//   상수가 바뀌어 동시 폴백 진입 태스크가 2개 미만이 되면 이 테스트의 레이스 검증력이 사라진다.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NaverNewsCollector } from '../src/adapters/naver-news';
import { launchBrowser, createBrowserContext } from '../src/utils/browser';

const { browserState } = vi.hoisted(() => ({
  browserState: {
    created: [] as Array<{ closed: boolean }>,
    reset() {
      this.created = [];
    },
  },
}));

vi.mock('../src/utils/browser', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/utils/browser')>();
  return {
    ...original,
    // 실제 launch처럼 시간이 걸리도록 지연 — check-then-act 레이스 재현 조건
    launchBrowser: vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      const fake = {
        closed: false,
        close: async () => {
          fake.closed = true;
        },
      };
      browserState.created.push(fake);
      return fake as unknown as import('playwright').Browser;
    }),
    createBrowserContext: vi.fn(async () => ({
      newPage: async () => ({
        goto: async () => {
          throw new Error('nav fail (test)');
        },
        waitForTimeout: async () => {},
        content: async () => '<html></html>',
      }),
    })),
    sleep: vi.fn(async () => {}),
  };
});

/** 검색 결과 fixture — 1차 셀렉터(sds-comps headline1) 경로로 파싱되는 기사 N건 */
function buildSearchFixture(count: number): string {
  const items = Array.from({ length: count }, (_, i) => {
    const aid = String(i + 1).padStart(10, '0');
    return `<div class="item">
      <a href="https://n.news.naver.com/article/001/${aid}">
        <span class="sds-comps-text-type-headline1">테스트 기사 제목 ${i + 1}번</span>
      </a>
      <img alt="연합뉴스의 프로필 이미지" />
    </div>`;
  }).join('\n');
  return `<html><body>${items}</body></html>`;
}

function stubFetch(fixtureCount: number): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes('search.naver.com')) {
        // 1페이지(start=1)만 fixture 반환 — start=11 등 후속 페이지와 혼동 방지 위해 정확 비교
        const start = new URL(url).searchParams.get('start');
        const html = start === '1' ? buildSearchFixture(fixtureCount) : '<html></html>';
        return new Response(html, { status: 200 });
      }
      // 기사 본문 fetch는 전부 실패 → FETCH_FAIL_THRESHOLD 도달 → Playwright 폴백 활성화
      throw new Error('article fetch fail (test)');
    }),
  );
}

async function collectAll(maxItems: number): Promise<unknown[]> {
  const collector = new NaverNewsCollector();
  const items: unknown[] = [];
  for await (const chunk of collector.collect({
    keyword: '테스트',
    startDate: '2026-06-09T00:00:00.000Z',
    endDate: '2026-06-09T00:00:00.000Z',
    maxItems,
  })) {
    items.push(...chunk);
  }
  return items;
}

describe('NaverNewsCollector Playwright 폴백 브라우저 정리', () => {
  beforeEach(() => {
    browserState.reset();
    vi.mocked(launchBrowser).mockClear();
    vi.mocked(createBrowserContext).mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('폴백 활성화 시 launchBrowser는 1회만 호출되고 모든 브라우저가 close된다', async () => {
    stubFetch(10);
    const items = await collectAll(10);

    // 수집 자체는 진행됨 (본문 null이어도 기사 yield)
    expect(items.length).toBeGreaterThan(0);
    // 폴백 브라우저는 정확히 1개만 launch되어야 함 (동시 태스크 단일 비행 보장)
    expect(launchBrowser).toHaveBeenCalledTimes(1);
    // 생성된 모든 브라우저는 close되어야 함 — 누수 0 보장
    const leaked = browserState.created.filter((b) => !b.closed);
    expect(leaked).toHaveLength(0);
  });

  it('폴백 init 실패 시 부분 생성 브라우저를 close하고 다음 배치에서 재시도한다', async () => {
    stubFetch(15); // 배치 1(10건: 웨이브1 실패 누적 + 웨이브2 폴백 init 실패) + 배치 2(5건: 재시도 성공)
    vi.mocked(createBrowserContext).mockImplementationOnce(async () => {
      throw new Error('context fail (test)');
    });

    const items = await collectAll(15);

    expect(items).toHaveLength(15);
    // 1차 init 실패 후 pwInit 리셋 → 다음 배치에서 재시도 = launch 정확히 2회
    expect(launchBrowser).toHaveBeenCalledTimes(2);
    expect(browserState.created).toHaveLength(2);
    // 실패한 init의 부분 생성 브라우저 포함 전부 close — 누수 0 보장
    const leaked = browserState.created.filter((b) => !b.closed);
    expect(leaked).toHaveLength(0);
  });
});
