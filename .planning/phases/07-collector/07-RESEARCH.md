# Phase 7: Collector 추상화 - Research

**Researched:** 2026-03-27
**Domain:** TypeScript 클래스 상속 기반 리팩토링 (Playwright + Cheerio 커뮤니티 수집기)
**Confidence:** HIGH

## Summary

4개 커뮤니티 수집기(clien, dcinside, fmkorea, naver-news)의 소스코드를 분석한 결과, clien/dcinside/fmkorea 3개는 거의 동일한 구조를 공유한다. collect() 메서드의 브라우저 초기화, 페이지 순회 루프, 에러 핸들링, finally 블록이 사실상 복사-붙여넣기 수준이며, 차이점은 (1) 사이트별 셀렉터 상수, (2) parseSearchResults/fetchPost/parseComments의 DOM 파싱 로직, (3) 딜레이 값 정도이다.

naver-news는 CommunityPost가 아닌 자체 NaverArticle 타입을 사용하고, 검색 URL 생성이 별도 유틸(naver-parser.ts)을 사용하며, 댓글 구조가 다르므로 동일한 BaseCollector 상속 패턴에 강제로 끼우기보다 브라우저 라이프사이클만 공유하는 방식이 적합하다. 커뮤니티 3개(clien/dcinside/fmkorea)는 CommunityBaseCollector를 상속하고, naver-news는 BrowserCollector(브라우저만 관리)를 상속하는 2단계 계층이 최선이다.

**Primary recommendation:** BrowserCollector(브라우저 라이프사이클) > CommunityBaseCollector(페이지 순회 + 공통 파싱 루프) > 개별 어댑터(셀렉터 + DOM 파싱) 3단계 계층으로 추출한다.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COL-01 | BaseCollector 추상 클래스 도입 (브라우저 초기화/페이지 순회/딜레이/에러처리) | 3개 수집기의 collect() 메서드에서 공통 패턴 식별 완료 -- BrowserCollector + CommunityBaseCollector 2단계 추출 |
| COL-02 | 4개 어댑터가 BaseCollector 상속, fetchPage()만 구현 | clien/dcinside/fmkorea는 CommunityBaseCollector 상속, naver-news는 BrowserCollector 상속. fetchPage 대신 parseSearchResults + fetchPost + parseComments 3개 추상 메서드가 적합 |
| COL-03 | 브라우저 유틸(launchBrowser, delay, contextOptions) 공통 모듈 통합 | browser.ts에 launchBrowser만 존재. community-parser.ts의 sleep/randomDelay + 각 어댑터의 USER_AGENTS/contextOptions를 browser.ts로 통합 |
| COL-04 | community-parser 중복 파싱 로직 제거 + 타입 강화 | naver-news에 자체 parseDateText 중복 발견. community-parser.ts 함수들에 반환 타입 명시 필요 |
| COL-05 | 기존 테스트 49개 모두 통과 | 현재 8파일 49테스트 모두 PASS 확인 (vitest 3.2.4) |
</phase_requirements>

## Architecture Patterns

### 현재 구조 (중복 분석)

```
src/adapters/
  base.ts           (29줄)  -- Collector 인터페이스 + CollectionOptions 스키마
  clien.ts          (262줄) -- ClienCollector
  dcinside.ts       (224줄) -- DCInsideCollector
  fmkorea.ts        (258줄) -- FMKoreaCollector
  naver-news.ts     (367줄) -- NaverNewsCollector (구조가 다름)
src/utils/
  browser.ts        (11줄)  -- launchBrowser만
  community-parser.ts (116줄) -- parseDateText, sleep, sanitizeContent, buildSearchUrl
```

### 중복 패턴 상세 (clien/dcinside/fmkorea 3개)

| 패턴 | 중복 줄수 (추정) | 설명 |
|------|-----------------|------|
| collect() 브라우저 초기화 | ~15줄 x 3 = 45줄 | launchBrowser + newContext(locale, timezone, userAgent) + newPage |
| collect() 페이지 순회 루프 | ~25줄 x 3 = 75줄 | for loop + maxItems 체크 + goto + waitForTimeout + parseSearchResults + 결과 빈 경우 break |
| collect() 게시글 수집 루프 | ~15줄 x 3 = 45줄 | for link of postLinks + fetchPost + push + sleep |
| collect() finally 블록 | ~5줄 x 3 = 15줄 | browser?.close() |
| fetchPost() 골격 | ~20줄 x 3 = 60줄 | goto + waitForTimeout + content + cheerio.load + 본문/메타/댓글 추출 + return CommunityPost |
| parseComments() 골격 | ~15줄 x 3 = 45줄 | selector 순회 + each + sanitizeContent + push CommunityComment |
| USER_AGENTS 배열 | ~5줄 x 3 = 15줄 | 동일한 3개 UA 문자열 |
| 상수 선언 (PAGE_DELAY 등) | ~5줄 x 3 = 15줄 | 값만 다른 동일 구조 |
| **합계** | **~315줄** | 제거 가능 중복 |

naver-news의 자체 parseDateText 중복: ~22줄 (community-parser.ts와 기능 중복)

### 추천 리팩토링 구조

```
src/adapters/
  base.ts                    -- Collector 인터페이스 + CollectionOptions (기존 유지)
  browser-collector.ts       -- BrowserCollector 추상 클래스 (브라우저 라이프사이클)
  community-base-collector.ts -- CommunityBaseCollector (페이지 순회 + 공통 파싱 루프)
  clien.ts                   -- ClienCollector extends CommunityBaseCollector
  dcinside.ts                -- DCInsideCollector extends CommunityBaseCollector
  fmkorea.ts                 -- FMKoreaCollector extends CommunityBaseCollector
  naver-news.ts              -- NaverNewsCollector extends BrowserCollector
  naver-comments.ts          -- (변경 없음)
  youtube-comments.ts        -- (변경 없음)
  youtube-videos.ts          -- (변경 없음)
  registry.ts                -- (변경 없음)
  index.ts                   -- export 업데이트
src/utils/
  browser.ts                 -- launchBrowser + createBrowserContext + USER_AGENTS + contextOptions
  community-parser.ts        -- (기존 유지, 타입 강화)
  naver-parser.ts            -- (변경 없음)
```

### Pattern 1: BrowserCollector 추상 클래스

**What:** 브라우저 라이프사이클(launch, context 생성, close)만 관리하는 최상위 추상 클래스
**When to use:** Playwright 기반 수집기가 공통으로 필요로 하는 브라우저 관리

```typescript
// src/adapters/browser-collector.ts
import { type Browser, type BrowserContext, type Page } from 'playwright';
import { launchBrowser, createBrowserContext } from '../utils/browser';
import type { Collector, CollectionOptions } from './base';

export interface BrowserCollectorConfig {
  pageDelay: { min: number; max: number };
  postDelay: { min: number; max: number };
  defaultMaxItems: number;
  maxSearchPages: number;
}

export abstract class BrowserCollector<T> implements Collector<T> {
  abstract readonly source: string;
  protected abstract readonly config: BrowserCollectorConfig;

  async *collect(options: CollectionOptions): AsyncGenerator<T[], void, unknown> {
    let browser: Browser | null = null;
    try {
      browser = await launchBrowser();
      const context = createBrowserContext(browser);
      const page = await (await context).newPage();
      yield* this.doCollect(page, options);
    } finally {
      if (browser) await browser.close();
    }
  }

  protected abstract doCollect(
    page: Page,
    options: CollectionOptions,
  ): AsyncGenerator<T[], void, unknown>;
}
```

### Pattern 2: CommunityBaseCollector 추상 클래스

**What:** 커뮤니티 3개(clien/dcinside/fmkorea)의 공통 페이지 순회 + 게시글 수집 루프
**When to use:** CommunityPost 타입을 반환하고 검색결과 > 게시글상세 2단계 수집 패턴을 따르는 경우

```typescript
// src/adapters/community-base-collector.ts
import type { Page } from 'playwright';
import type { CollectionOptions } from './base';
import type { CommunityPost } from '../types/community';
import { sleep } from '../utils/browser';
import { BrowserCollector, type BrowserCollectorConfig } from './browser-collector';

export interface SiteSelectors {
  list: string[];
  content: string[];
  comment: string[];
}

export abstract class CommunityBaseCollector extends BrowserCollector<CommunityPost> {
  protected abstract readonly selectors: SiteSelectors;
  protected abstract readonly baseUrl: string;

  // 사이트별 검색 URL 생성
  protected abstract buildSearchUrl(keyword: string, page: number): string;
  // 사이트별 검색 결과 파싱
  protected abstract parseSearchResults(html: string): { url: string; title: string }[];
  // 사이트별 게시글 상세 파싱
  protected abstract fetchPost(page: Page, url: string, title: string, maxComments: number): Promise<CommunityPost | null>;

  protected async *doCollect(page: Page, options: CollectionOptions): AsyncGenerator<CommunityPost[], void, unknown> {
    const maxItems = options.maxItems ?? this.config.defaultMaxItems;
    const maxComments = options.maxComments ?? 100;
    let totalCollected = 0;

    for (let pageNum = 1; pageNum <= this.config.maxSearchPages; pageNum++) {
      if (totalCollected >= maxItems) break;

      const searchUrl = this.buildSearchUrl(options.keyword, pageNum);
      try {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch {
        break;
      }
      await page.waitForTimeout(this.config.pageDelay.min + Math.random() * 1000);

      const html = await page.content();
      const postLinks = this.parseSearchResults(html);
      if (postLinks.length === 0) break;

      const posts: CommunityPost[] = [];
      for (const link of postLinks) {
        if (totalCollected >= maxItems) break;
        try {
          const post = await this.fetchPost(page, link.url, link.title, maxComments);
          if (post) { posts.push(post); totalCollected++; }
        } catch (err) {
          console.warn(`${this.source} 게시글 수집 실패 (${link.url}):`, err);
        }
        await sleep(this.config.postDelay.min, this.config.postDelay.max);
      }

      if (posts.length > 0) yield posts;
      await sleep(this.config.pageDelay.min, this.config.pageDelay.max);
    }
  }
}
```

### Pattern 3: 개별 어댑터 (리팩토링 후)

**What:** 사이트별 셀렉터와 DOM 파싱 로직만 남긴 경량 어댑터

```typescript
// src/adapters/clien.ts (리팩토링 후 ~120줄 예상)
export class ClienCollector extends CommunityBaseCollector {
  readonly source = 'clien';
  protected readonly baseUrl = 'https://www.clien.net';
  protected readonly config = {
    pageDelay: { min: 3000, max: 5000 },
    postDelay: { min: 1500, max: 2500 },
    defaultMaxItems: 50,
    maxSearchPages: 15,
  };
  protected readonly selectors = {
    list: ['.list_item a.subject_fixed', /* ... */],
    content: ['.post_article', '.post_content', '#div_content'],
    comment: ['.comment_view .comment_content', '.comment_row .comment_content'],
  };

  protected buildSearchUrl(keyword: string, page: number): string { /* ... */ }
  protected parseSearchResults(html: string): { url: string; title: string }[] { /* ... */ }
  protected async fetchPost(page: Page, url: string, title: string, maxComments: number): Promise<CommunityPost | null> { /* ... */ }
}
```

### Anti-Patterns to Avoid

- **과도한 추상화:** fetchPost 내부의 본문/메타/댓글 추출까지 공통화하면 사이트별 예외처리가 어려워진다. fetchPost 수준에서 추상 메서드를 끊는 것이 적절하다.
- **Template Method 남용:** 차단 감지(blocked detection) 로직은 clien과 fmkorea에만 있고 dcinside에는 없다. 이를 강제로 공통 훅으로 만들면 불필요한 복잡도가 생긴다. 선택적 protected 메서드(기본 no-op)로 제공한다.
- **naver-news 강제 통합:** NaverArticle 타입이 CommunityPost와 다르고 검색 로직도 다르므로, CommunityBaseCollector에 억지로 맞추면 제네릭 복잡도만 증가한다. BrowserCollector만 상속하는 것이 옳다.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 브라우저 컨텍스트 옵션 | 각 어댑터에서 newContext 직접 호출 | createBrowserContext() 공통 함수 | locale, timezone, userAgent 설정이 3곳에서 동일하게 반복 |
| 랜덤 딜레이 | 각 어댑터에서 sleep/delay 자체 구현 | 공통 sleep() 함수 (browser.ts) | naver-news가 자체 delay() 함수를 별도 정의하고 있음 |
| User-Agent 로테이션 | 각 어댑터에서 USER_AGENTS 배열 복사 | getRandomUserAgent() 공통 함수 | 3개 어댑터에서 동일한 배열 반복 선언 |

## Common Pitfalls

### Pitfall 1: private 메서드를 protected로 변경 시 테스트 깨짐
**What goes wrong:** parseSearchResults, fetchPost, parseComments가 현재 private이므로 테스트에서 직접 호출할 수 없다. protected로 변경하면 서브클래스에서 접근 가능하지만, 기존 테스트가 인스턴스에서 직접 호출하는 방식이면 깨질 수 있다.
**How to avoid:** 현재 테스트는 collect()의 AsyncGenerator 반환만 확인하고 내부 메서드를 직접 테스트하지 않으므로 실제 위험 낮음. 단, 리팩토링 후 private -> protected 변경 시 TypeScript 컴파일 에러 없는지 확인 필수.

### Pitfall 2: naver-news의 parseDateText 중복 제거 시 반환 타입 불일치
**What goes wrong:** community-parser.ts의 parseDateText는 `Date`를 반환하지만, naver-news의 자체 parseDateText는 `Date | null`을 반환한다. 단순 치환하면 null 체크 누락으로 런타임 에러 발생 가능.
**How to avoid:** community-parser.ts의 parseDateText가 파싱 실패 시 `new Date()`를 반환하는 동작을 유지하되, naver-news에서 사용할 때는 null 체크가 필요한 곳에서 별도 래퍼를 사용하거나, parseDateText에 옵셔널 파라미터로 fallback 동작을 제어한다.

### Pitfall 3: 차단 감지 로직 손실
**What goes wrong:** clien과 fmkorea에는 차단 감지(blocked detection) 로직이 있지만 dcinside에는 없다. CommunityBaseCollector에 공통 로직으로 올리면 dcinside에 불필요한 로직이 추가되고, 올리지 않으면 각 어댑터에서 중복 구현해야 한다.
**How to avoid:** CommunityBaseCollector에 `protected detectBlocked(html: string): boolean` 메서드를 기본 `return false`로 정의하고, clien/fmkorea에서만 override한다.

### Pitfall 4: export 경로 변경으로 외부 consumer 깨짐
**What goes wrong:** 다른 패키지에서 `@ai-signalcraft/collectors`를 import하는 코드가 있을 때, export 구조가 바뀌면 컴파일 에러 발생.
**How to avoid:** index.ts의 public API를 유지한다. 내부 구조만 변경하고 export는 기존과 동일하게 유지.

## Standard Stack

이 phase는 리팩토링 전용이므로 새로운 라이브러리 추가 없음. 기존 스택만 사용:

| Library | Version | Purpose |
|---------|---------|---------|
| TypeScript | 5.x | 추상 클래스, protected/abstract 키워드 |
| Playwright | 1.50.x | Browser, BrowserContext, Page 타입 |
| Cheerio | 1.x | CheerioAPI 타입 |
| Vitest | 3.2.4 | 기존 테스트 실행 |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `packages/collectors/vitest.config.ts` |
| Quick run command | `pnpm --filter @ai-signalcraft/collectors test` |
| Full suite command | `pnpm --filter @ai-signalcraft/collectors test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COL-01 | BaseCollector 추상 클래스 존재 + 공통 기능 제공 | unit | `pnpm --filter @ai-signalcraft/collectors test` | Wave 0 (base-collector 테스트 추가 필요) |
| COL-02 | 4개 어댑터가 BaseCollector 상속 + collect 동작 | unit | `pnpm --filter @ai-signalcraft/collectors test` | 기존 adapter.test.ts + 개별 테스트 |
| COL-03 | 브라우저 유틸 공통 모듈 export | unit | `pnpm --filter @ai-signalcraft/collectors test` | Wave 0 (browser util 테스트 추가 필요) |
| COL-04 | community-parser 중복 제거 + 타입 강화 | unit | `pnpm --filter @ai-signalcraft/collectors test` | 기존 dcinside.test.ts 내 parser 테스트 |
| COL-05 | 기존 49개 테스트 모두 통과 | regression | `pnpm --filter @ai-signalcraft/collectors test` | 기존 8파일 49테스트 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @ai-signalcraft/collectors test`
- **Per wave merge:** `pnpm --filter @ai-signalcraft/collectors test`
- **Phase gate:** 49개 기존 테스트 + 신규 테스트 모두 green

### Wave 0 Gaps
- [ ] `tests/browser-collector.test.ts` -- BrowserCollector 추상 클래스 테스트 (COL-01)
- [ ] `tests/browser-utils.test.ts` -- createBrowserContext, getRandomUserAgent 테스트 (COL-03)

## Code Examples

### 현재 중복 코드 (3개 어댑터 공통)

브라우저 초기화 패턴 (clien.ts:53-61, dcinside.ts:48-56, fmkorea.ts:50-58):
```typescript
// 3곳에서 동일한 코드
browser = await launchBrowser();
const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
const context = await browser.newContext({
  locale: 'ko-KR',
  timezoneId: 'Asia/Seoul',
  userAgent,
});
const page = await context.newPage();
```

페이지 순회 루프 (3곳에서 동일 구조, 딜레이 값만 다름):
```typescript
// collect() 내부 -- 3곳 동일
for (let pageNum = 1; pageNum <= MAX_SEARCH_PAGES; pageNum++) {
  if (totalCollected >= maxItems) break;
  const searchUrl = buildSearchUrl(site, options.keyword, pageNum);
  // ... goto, waitForTimeout, parseSearchResults ...
  const posts: CommunityPost[] = [];
  for (const link of postLinks) {
    // ... fetchPost, push, sleep ...
  }
  if (posts.length > 0) yield posts;
  await sleep(PAGE_DELAY.min, PAGE_DELAY.max);
}
```

### naver-news 자체 delay/parseDateText 중복

```typescript
// naver-news.ts:30-33 -- community-parser.ts의 sleep과 동일 기능
function delay(minMs: number, maxMs?: number): Promise<void> {
  const ms = maxMs ? minMs + Math.random() * (maxMs - minMs) : minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// naver-news.ts:344-366 -- community-parser.ts의 parseDateText와 기능 중복
// 차이: 반환 타입이 Date | null (community-parser는 Date)
```

### 리팩토링 후 browser.ts 확장 예시

```typescript
// src/utils/browser.ts (확장 후)
import { chromium, type Browser, type BrowserContext } from 'playwright';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ...',
];

export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export const DEFAULT_CONTEXT_OPTIONS = {
  locale: 'ko-KR' as const,
  timezoneId: 'Asia/Seoul' as const,
};

export async function launchBrowser(): Promise<Browser> {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  return chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
}

export async function createBrowserContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    ...DEFAULT_CONTEXT_OPTIONS,
    userAgent: getRandomUserAgent(),
  });
}

export function sleep(min: number, max?: number): Promise<void> {
  const ms = max ? min + Math.random() * (max - min) : min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 각 어댑터에서 전체 수집 로직 구현 | BaseCollector 추상 클래스 + Template Method | 이번 phase | ~315줄 중복 제거, 새 사이트 추가 시 ~80줄만 작성 |
| community-parser + naver-news 자체 유틸 병존 | 공통 유틸 단일 모듈 | 이번 phase | parseDateText/delay 중복 ~25줄 제거 |

## Open Questions

1. **fetchPost를 추상 메서드 1개로 둘 것인가, parseSearchResults/fetchPost/parseComments 3개로 분리할 것인가?**
   - What we know: 현재 3개 어댑터 모두 parseSearchResults, fetchPost, parseComments를 private 메서드로 보유. 구조가 동일하나 DOM 셀렉터와 파싱 로직이 사이트마다 다름.
   - Recommendation: 3개로 분리한다. parseSearchResults와 parseComments는 fetchPost와 독립적으로 테스트 가능하고, 향후 사이트 추가 시 각각 독립 구현 가능.

2. **naver-news의 parseDateText 반환 타입(Date | null) vs community-parser의 parseDateText(Date) 불일치**
   - What we know: community-parser는 파싱 실패 시 new Date() 반환 (null 불가). naver-news는 null 반환 가능.
   - Recommendation: community-parser에 `parseDateTextOrNull(text: string): Date | null` 추가하고, naver-news가 이를 사용하도록 한다. 기존 parseDateText(fallback to now)는 호환성 유지.

## Sources

### Primary (HIGH confidence)
- 소스코드 직접 분석: `packages/collectors/src/adapters/*.ts`, `packages/collectors/src/utils/*.ts`
- 테스트 실행 결과: 8파일 49테스트 PASS (vitest 3.2.4, 2026-03-27 확인)

### Secondary (MEDIUM confidence)
- TypeScript abstract class + Template Method pattern: 표준 OOP 패턴, 별도 라이브러리 불필요

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - 새 라이브러리 추가 없음, 기존 스택만 사용
- Architecture: HIGH - 소스코드 직접 분석으로 중복 패턴 확인 완료
- Pitfalls: HIGH - 타입 불일치, export 경로 변경 등 구체적 위험 식별

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (안정적 리팩토링, 외부 의존성 없음)
