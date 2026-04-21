// 네이버 뉴스 기사 수집기 (하이브리드: 검색=fetch, 본문=fetch 우선 + Playwright 폴백)
import { createHash } from 'node:crypto';
import type { Browser, Page } from 'playwright';
import * as cheerio from 'cheerio';
import { buildNaverSearchUrl, parseNaverArticleUrl } from '../utils/naver-parser';
import { parseDateTextOrNull, splitIntoDaysKst } from '../utils/community-parser';
import { getRandomUserAgent, launchBrowser, createBrowserContext, sleep } from '../utils/browser';
import type { Collector, CollectionOptions } from './base';

/** 수집된 네이버 뉴스 기사 */
export interface NaverArticle {
  sourceId: string; // oid + aid 조합
  url: string;
  title: string;
  content: string | null;
  author: string | null;
  publisher: string;
  publishedAt: Date | null;
  rawData: Record<string, unknown>;
}

// 검색 페이지 fetch 요청 헤더
const SEARCH_HEADERS: Record<string, string> = {
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  Referer: 'https://search.naver.com/',
};

// 기사 본문 fetch 요청 헤더
const ARTICLE_HEADERS: Record<string, string> = {
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: 'https://search.naver.com/',
};

// Phase 2 본문 병렬 수집 동시성
const ARTICLE_CONCURRENCY = 5;
// fetch 연속 실패 시 Playwright 폴백 전환 임계값
const FETCH_FAIL_THRESHOLD = 5;

/**
 * 네이버 검색 결과 블록 텍스트에서 작성일을 추출.
 * 지원: "N분/시간/일/주/달/개월/년 전", "YYYY.MM.DD." (절대일자)
 * 상대시간만 매칭하던 기존 로직은 7일 이상 지난 기사("1주 전")나 절대 일자 표기를 모두 놓쳤다.
 */
function extractNaverPublishedAt(blockText: string): Date | null {
  const relMatch = blockText.match(/(\d+)\s*(분|시간|일|주|달|개월|년)\s*전/);
  if (relMatch) {
    return parseDateTextOrNull(`${relMatch[1]}${relMatch[2]} 전`);
  }
  const absMatch = blockText.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})\.?/);
  if (absMatch) {
    return parseDateTextOrNull(`${absMatch[1]}.${absMatch[2]}.${absMatch[3]}`);
  }
  return null;
}

/**
 * NaverNewsCollector (하이브리드)
 *
 * 검색 결과 목록: fetch + Cheerio (브라우저 불필요, ~200ms/페이지)
 * 기사 본문 수집: fetch 우선 + Playwright 폴백 (병렬 처리, ~100-300ms/건)
 * AsyncGenerator로 배치 단위(최대 10건)로 yield.
 */
export class NaverNewsCollector implements Collector<NaverArticle> {
  readonly source = 'naver-news';

  private readonly config = {
    searchDelay: { min: 300, max: 600 },
    articleDelay: { min: 50, max: 150 }, // fetch 병렬 시 burst 방지 미세 딜레이
    defaultMaxItems: 1000,
    maxSearchPages: 100,
  };

  async *collect(options: CollectionOptions): AsyncGenerator<NaverArticle[], void, unknown> {
    const maxItems = options.maxItems ?? this.config.defaultMaxItems;
    let totalCollected = 0;

    // Phase 1: 날짜 분할 검색 (Date-Chunked Collection)
    // 기간을 일별로 분할하여 각 날짜에서 균등하게 수집 — 최신순 편중 방지
    const allArticles: NaverArticle[] = [];
    // 전체 수집 동안 sourceId 중복 제거 (cross-page/cross-day)
    const globalSeenSourceIds = new Set<string>();
    const days = this.splitIntoDays(options.startDate, options.endDate);
    // perDayLimit 우선순위:
    //   1) options.maxItemsPerDay (flows.ts가 perDay 모드일 때 사용자 원본 한도를 명시 전달)
    //   2) 미지정 시 maxItems / dayCount의 floor — total 모드 등에서도 일자 편중 방지.
    // ⚠️ 한도 초과 금지: 절대 perDayLimit을 넘기지 않는다.
    // ⚠️ 부족분 보충 금지: 한 일자가 모자라도 다른 일자에서 채우지 않는다.
    const perDayLimit = options.maxItemsPerDay ?? Math.max(1, Math.floor(maxItems / days.length));
    const maxPagesPerDay = 40;

    // 날짜별 페이지 진행 상태 (단일 패스, 보충 없음)
    const dayProgress = new Map<number, { nextPage: number; exhausted: boolean }>();
    days.forEach((_, idx) => dayProgress.set(idx, { nextPage: 1, exhausted: false }));

    // 단일 날짜에서 perDayLimit 까지만 수집 (절대 초과 금지)
    const collectFromDay = async (dayIdx: number): Promise<number> => {
      const progress = dayProgress.get(dayIdx)!;
      if (progress.exhausted) return 0;

      const day = days[dayIdx];
      const dayStr = day.toISOString();
      let collectedThisDay = 0;

      while (collectedThisDay < perDayLimit && progress.nextPage <= maxPagesPerDay) {
        const searchUrl = buildNaverSearchUrl({
          keyword: options.keyword,
          startDate: dayStr,
          endDate: dayStr,
          page: progress.nextPage,
          sort: 1,
        });

        try {
          const response = await fetch(searchUrl, {
            headers: { ...SEARCH_HEADERS, 'User-Agent': getRandomUserAgent() },
          });
          if (!response.ok) {
            progress.exhausted = true;
            break;
          }

          const html = await response.text();
          const articles = this.parseSearchResults(html);
          if (articles.length === 0) {
            progress.exhausted = true;
            break;
          }

          const fresh = articles.filter((a) => {
            if (globalSeenSourceIds.has(a.sourceId)) return false;
            globalSeenSourceIds.add(a.sourceId);
            return true;
          });

          // perDayLimit을 절대 넘지 않도록 잘라내서 push
          const room = perDayLimit - collectedThisDay;
          const accepted = fresh.slice(0, room);
          allArticles.push(...accepted);
          collectedThisDay += accepted.length;
          progress.nextPage++;
        } catch {
          progress.exhausted = true;
          break;
        }

        await sleep(this.config.searchDelay.min, this.config.searchDelay.max);
      }

      if (progress.nextPage > maxPagesPerDay) progress.exhausted = true;
      return collectedThisDay;
    };

    // 단일 패스: 각 날짜에서 perDayLimit까지만 수집. 부족분은 보충하지 않음.
    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      await collectFromDay(dayIdx);
    }

    // TTL 재사용: 완전 스킵 URL 은 Phase 2 본문 수집에서 제외
    // 재사용 기사는 flows.ts 에서 article_jobs 로 이미 연결됨 → 분석 단계에서 자동 포함
    const skipUrlSet = new Set(options.reusePlan?.skipUrls ?? []);
    const refetchCommentsOnlySet = new Set(
      (options.reusePlan?.refetchCommentsFor ?? []).map((s) => s.url),
    );
    const preSkipCount = allArticles.length;
    const filteredArticles = allArticles.filter((a) => !skipUrlSet.has(a.url));
    const skippedByReuse = preSkipCount - filteredArticles.length;
    if (skippedByReuse > 0) {
      console.info(`naver-news TTL 재사용으로 ${skippedByReuse}건 본문 수집 스킵`);
    }

    // ⚠️ yield 직전 일자별 cap 최후 검증 — 사전 cap이 어떤 이유로 누락되어도 절대 한도 초과 X.
    // 네이버는 일자별 분할 검색이라 사전에 cap이 잘 보장되지만, 안전망으로 한 번 더 잘라낸다.
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    const dayKeyMs = (d: Date | null): number | null => {
      if (!d) return null;
      const t = d.getTime();
      return Math.floor((t + KST_OFFSET) / 86400000) * 86400000 - KST_OFFSET;
    };
    const enforced = new Map<number, number>();
    const enforcedArticles: NaverArticle[] = [];
    let droppedByEnforce = 0;
    for (const a of filteredArticles) {
      const k = dayKeyMs(a.publishedAt);
      if (k === null) {
        enforcedArticles.push(a);
        continue;
      }
      const cur = enforced.get(k) ?? 0;
      if (cur >= perDayLimit) {
        droppedByEnforce++;
        continue;
      }
      enforced.set(k, cur + 1);
      enforcedArticles.push(a);
    }
    if (droppedByEnforce > 0) {
      console.warn(
        `naver-news ⚠️ enforcePerDayCap: ${droppedByEnforce}건 추가 제거 (한도 ${perDayLimit}/일)`,
      );
    }

    // maxItems 제한
    const targetArticles = enforcedArticles.slice(0, maxItems);
    if (targetArticles.length === 0) return;

    // Phase 2: 기사 본문 수집 (fetch 우선 + Playwright 폴백, 병렬 처리)
    const pw: { browser: Browser | null; page: Page | null } = { browser: null, page: null };
    let fetchFailCount = 0;

    // 세마포어: 외부 의존성 없이 동시성 제어
    let running = 0;
    const waitQueue: (() => void)[] = [];
    const acquire = (): Promise<void> => {
      if (running < ARTICLE_CONCURRENCY) {
        running++;
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => waitQueue.push(resolve));
    };
    const release = (): void => {
      const next = waitQueue.shift();
      if (next) {
        next();
      } else {
        running--;
      }
    };

    try {
      const BATCH_SIZE = 10;
      for (let i = 0; i < targetArticles.length; i += BATCH_SIZE) {
        const batch = targetArticles.slice(i, Math.min(i + BATCH_SIZE, targetArticles.length));

        const enriched = await Promise.all(
          batch.map(async (article) => {
            if (totalCollected >= maxItems) return null;
            await acquire();
            try {
              // fetch 연속 실패 시 Playwright 폴백 준비 (lazy init)
              if (fetchFailCount >= FETCH_FAIL_THRESHOLD && !pw.browser) {
                pw.browser = await launchBrowser();
                const context = await createBrowserContext(pw.browser);
                pw.page = await context.newPage();
                console.warn(`naver-news fetch ${fetchFailCount}회 실패 → Playwright 폴백 활성화`);
              }

              const _commentsOnly = refetchCommentsOnlySet.has(article.url);
              const { content, publishedAt } = await this.fetchArticleContent(
                article.url,
                pw.page ?? undefined,
              );
              article.content = content;
              if (publishedAt) article.publishedAt = publishedAt;
              if (!content) fetchFailCount++;
            } catch (err) {
              article.content = null;
              article.rawData.fetchError = err instanceof Error ? err.message : String(err);
              fetchFailCount++;
            } finally {
              release();
            }
            await sleep(this.config.articleDelay.min, this.config.articleDelay.max);
            totalCollected++;
            return article;
          }),
        );

        const valid = enriched.filter((a): a is NaverArticle => a !== null);
        if (valid.length > 0) {
          yield valid;
        }
      }
    } finally {
      if (pw.browser) await pw.browser.close();
    }
  }

  /**
   * 검색 결과 HTML에서 기사 목록 파싱
   * 2026-03 기준: 네이버 SDS 디자인 시스템(sds-comps-*) 사용
   *
   * 전략:
   * 1차) headline1 셀렉터로 제목 요소를 찾고, 부모 a 태그에서 기사 URL 추출
   *      -> n.news.naver.com 링크가 있으면 네이버뉴스 URL, 없으면 원본 언론사 URL
   * 2차) n.news.naver.com 링크 기반 탐색 (1차에서 못 잡은 기사 보완)
   * 3차) 레거시 셀렉터 폴백 (.news_area, .news_tit 등)
   */
  private parseSearchResults(html: string): NaverArticle[] {
    const $ = cheerio.load(html);
    const articles: NaverArticle[] = [];
    const seen = new Set<string>(); // URL 기반 중복 제거

    // --- 1차: sds-comps headline1 기반 (2026-03 네이버 구조) ---
    $('[class*="sds-comps-text-type-headline1"]').each((_, el) => {
      const title = $(el).text().trim();
      if (!title || title.length < 5) return;

      const $parentLink = $(el).closest('a[href]');
      const articleUrl = $parentLink.attr('href') ?? '';
      if (!articleUrl || !articleUrl.startsWith('http')) return;

      if (seen.has(articleUrl)) return;
      seen.add(articleUrl);

      let $block = $(el);
      for (let i = 0; i < 8; i++) {
        $block = $block.parent();
        if ($block.find('img[alt$="의 프로필 이미지"]').length > 0) break;
      }

      let publisher = '알 수 없음';
      const $pubImg = $block.find('img[alt$="의 프로필 이미지"]').first();
      if ($pubImg.length) {
        const alt = $pubImg.attr('alt') ?? '';
        publisher = alt.replace('의 프로필 이미지', '').trim() || publisher;
      }

      const blockText = $block.text();
      const publishedAt = extractNaverPublishedAt(blockText);

      let naverUrl: string | null = null;
      $block.find('a[href*="n.news.naver.com"]').each((_, a) => {
        if (!naverUrl) {
          const href = $(a).attr('href') ?? '';
          if (parseNaverArticleUrl(href)) naverUrl = href;
        }
      });

      const parsed = naverUrl ? parseNaverArticleUrl(naverUrl) : null;
      const sourceId = parsed ? `${parsed.oid}_${parsed.aid}` : this.urlToSourceId(articleUrl);

      articles.push({
        sourceId,
        url: naverUrl ?? articleUrl,
        title,
        content: null,
        author: null,
        publisher,
        publishedAt,
        rawData: {
          naverUrl: naverUrl ?? undefined,
          originalUrl: articleUrl,
          hasNaverNews: !!naverUrl,
        },
      });
    });

    // --- 2차: n.news.naver.com 링크 기반 (1차에서 못 잡은 기사 보완) ---
    $('a[href*="n.news.naver.com"]').each((_, el) => {
      const naverUrl = $(el).attr('href') ?? '';
      const parsed = parseNaverArticleUrl(naverUrl);
      if (!parsed) return;

      const sourceId = `${parsed.oid}_${parsed.aid}`;
      if (articles.some((a) => a.sourceId === sourceId)) return;
      if (seen.has(naverUrl)) return;
      seen.add(naverUrl);

      let block = $(el);
      for (let i = 0; i < 5; i++) block = block.parent();

      let title = '';
      let originalUrl = '';
      block.find('a').each((_, a) => {
        if (title) return;
        const text = $(a).text().trim();
        const href = $(a).attr('href') ?? '';
        if (text.length > 10 && href.startsWith('http') && !href.includes('n.news.naver.com')) {
          title = text;
          originalUrl = href;
        }
      });

      if (!title) {
        const blockText = block.text().trim();
        const segments = blockText
          .split('\n')
          .map((s) => s.trim())
          .filter((s) => s.length > 15);
        title = segments[0] ?? blockText.substring(0, 100);
      }

      if (!title) return;

      const blockText = block.text();
      const pubMatch = blockText.match(
        /([가-힣A-Za-z0-9\s]+?)(?:\d+\s*(?:분|시간|일|주|달|개월|년)\s*전|\d{4}\.\d{1,2}\.\d{1,2}|네이버뉴스)/,
      );
      const publisher = pubMatch?.[1]?.trim() || '알 수 없음';
      const publishedAt = extractNaverPublishedAt(blockText);

      articles.push({
        sourceId,
        url: naverUrl,
        title,
        content: null,
        author: null,
        publisher,
        publishedAt,
        rawData: { naverUrl, originalUrl: originalUrl || undefined },
      });
    });

    // --- 3차: 레거시 셀렉터 폴백 ---
    if (articles.length === 0) {
      $('.news_area, .news_wrap').each((_, element) => {
        const $el = $(element);
        const $titleLink = $el.find('.news_tit, a.news_tit').first();
        const title = $titleLink.text().trim();
        const url = $titleLink.attr('href') ?? '';
        if (!title || !url) return;

        const publisher = $el.find('.info.press').first().text().trim() || '알 수 없음';
        const dateText = $el.find('.info_group span.info').last().text().trim();
        const parsedUrl = parseNaverArticleUrl(url);
        const sourceId = parsedUrl ? `${parsedUrl.oid}_${parsedUrl.aid}` : url;

        articles.push({
          sourceId,
          url,
          title,
          content: null,
          author: null,
          publisher,
          publishedAt: parseDateTextOrNull(dateText),
          rawData: { dateText },
        });
      });
    }

    // 네이버뉴스 URL이 있는 기사를 우선 정렬 (댓글 수집 가능한 기사 우선)
    articles.sort((a, b) => {
      const aHasNaver = a.url.includes('n.news.naver.com') ? 0 : 1;
      const bHasNaver = b.url.includes('n.news.naver.com') ? 0 : 1;
      return aHasNaver - bHasNaver;
    });

    return articles;
  }

  /**
   * 날짜 범위를 일별로 분할 (KST 자정 기준).
   * 컨테이너 TZ가 UTC인 운영 환경에서도 사용자(한국)가 보는 일자와 정확히 일치한다.
   */
  private splitIntoDays(startDate: string, endDate: string): Date[] {
    return splitIntoDaysKst(startDate, endDate);
  }

  /**
   * URL에서 고유 sourceId 생성 (네이버뉴스 URL이 없는 기사용)
   * 전체 URL의 SHA-1 해시를 사용해 truncate로 인한 충돌 방지
   */
  private urlToSourceId(url: string): string {
    const hash = createHash('sha1').update(url).digest('hex').slice(0, 16);
    try {
      const u = new URL(url);
      return `ext_${u.hostname.replace(/\./g, '_')}_${hash}`;
    } catch {
      return `ext_${hash}`;
    }
  }

  /**
   * 기사 본문 + 게시 시각 수집 (fetch 우선, Playwright 폴백)
   * n.news.naver.com은 SSR이므로 fetch + Cheerio만으로 본문 추출 가능.
   * fetch 실패 시에만 Playwright를 사용한다.
   */
  private async fetchArticleContent(
    url: string,
    fallbackPage?: Page,
  ): Promise<{ content: string | null; publishedAt: Date | null }> {
    // 1차: fetch (SSR — JS 렌더링 불필요, ~100-300ms)
    try {
      const response = await fetch(url, {
        headers: { ...ARTICLE_HEADERS, 'User-Agent': getRandomUserAgent() },
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const html = await response.text();
        const result = this.parseArticleHtml(html);
        if (result.content) return result;
      }
    } catch {
      // fetch 실패 → Playwright 폴백
    }

    // 2차: Playwright 폴백
    if (fallbackPage) {
      try {
        await fallbackPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await fallbackPage.waitForTimeout(500);
        const html = await fallbackPage.content();
        return this.parseArticleHtml(html);
      } catch {
        // Playwright도 실패
      }
    }

    return { content: null, publishedAt: null };
  }

  private parseArticleHtml(html: string): { content: string | null; publishedAt: Date | null } {
    const $ = cheerio.load(html);

    let publishedAt: Date | null = null;
    const dateAttr =
      $('[data-date-time]').first().attr('data-date-time') ??
      $('._ARTICLE_DATE_TIME').first().attr('data-date-time');
    if (dateAttr) {
      const m = dateAttr.match(
        /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/,
      );
      if (m) {
        const iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}T${m[4].padStart(2, '0')}:${m[5].padStart(2, '0')}:${(m[6] ?? '00').padStart(2, '0')}+09:00`;
        const d = new Date(iso);
        if (!Number.isNaN(d.getTime())) publishedAt = d;
      }
    }

    const contentSelectors = [
      '#newsct_article',
      '.newsct_article',
      '#dic_area',
      '#articeBody',
      '#articleBody',
      '.article_body',
      '.article-body',
      '#article-body',
      '#article_body',
      '.news_content',
      '.article_content',
      '.story-news',
      '#article_content',
      '.view_article',
      '#news_body',
      'article',
    ];

    for (const selector of contentSelectors) {
      const content = $(selector).text().trim();
      if (content && content.length > 50) {
        return { content, publishedAt };
      }
    }

    return { content: null, publishedAt };
  }
}
