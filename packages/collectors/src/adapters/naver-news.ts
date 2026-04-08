// 네이버 뉴스 기사 수집기 (하이브리드: 검색=fetch, 본문=Playwright)
import { createHash } from 'node:crypto';
import type { Browser, Page } from 'playwright';
import * as cheerio from 'cheerio';
import { buildNaverSearchUrl, parseNaverArticleUrl } from '../utils/naver-parser';
import { parseDateTextOrNull } from '../utils/community-parser';
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

/**
 * NaverNewsCollector (하이브리드)
 *
 * 검색 결과 목록: fetch + Cheerio (브라우저 불필요, ~200ms/페이지)
 * 기사 본문 수집: Playwright (일부 언론사 JS 렌더링 필요)
 * AsyncGenerator로 페이지 단위(최대 10건)로 yield.
 */
export class NaverNewsCollector implements Collector<NaverArticle> {
  readonly source = 'naver-news';

  private readonly config = {
    searchDelay: { min: 300, max: 600 }, // 검색 페이지 간 딜레이 (fetch이므로 짧게)
    postDelay: { min: 500, max: 1000 }, // 기사 본문 간 딜레이
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
    const perDayLimit = Math.ceil(maxItems / days.length);
    // 네이버 단일 날짜 검색 한계(~40페이지)까지 허용.
    // 이전 `maxSearchPages/days.length` 공식은 긴 기간에서 날짜당 2~4페이지로 극도 제한되어
    // Pass 2 보충 시 페이지 여유가 없어 maxItems 미달이 발생했음.
    const maxPagesPerDay = 40;

    // 날짜별로 수집한 페이지 진행 상태 추적 (2-패스 보충을 위해)
    const dayProgress = new Map<number, { nextPage: number; exhausted: boolean }>();
    days.forEach((_, idx) => dayProgress.set(idx, { nextPage: 1, exhausted: false }));

    // 단일 날짜에서 지정한 수만큼 수집하는 헬퍼 (page 진행 상태 유지)
    const collectFromDay = async (dayIdx: number, targetCount: number): Promise<number> => {
      const progress = dayProgress.get(dayIdx)!;
      if (progress.exhausted) return 0;

      const day = days[dayIdx];
      const dayStr = day.toISOString();
      let collected = 0;

      while (collected < targetCount && progress.nextPage <= maxPagesPerDay) {
        if (allArticles.length >= maxItems) break;

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

          allArticles.push(...fresh);
          collected += fresh.length;
          progress.nextPage++;
        } catch {
          progress.exhausted = true;
          break;
        }

        await sleep(this.config.searchDelay.min, this.config.searchDelay.max);
      }

      if (progress.nextPage > maxPagesPerDay) progress.exhausted = true;
      return collected;
    };

    // Pass 1: 각 날짜에서 perDayLimit까지 시도
    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      if (allArticles.length >= maxItems) break;
      await collectFromDay(dayIdx, perDayLimit);
    }

    // Pass 2: 부족분을 아직 고갈되지 않은 날짜들에서 보충
    // round-robin 방식으로 페이지 단위(~10건)씩 돌며 maxItems 도달 또는 모든 날짜 고갈될 때까지
    while (allArticles.length < maxItems) {
      const availableDays = Array.from(dayProgress.entries())
        .filter(([, p]) => !p.exhausted)
        .map(([idx]) => idx);
      if (availableDays.length === 0) break;

      let progressedThisRound = false;
      for (const dayIdx of availableDays) {
        if (allArticles.length >= maxItems) break;
        const need = maxItems - allArticles.length;
        const got = await collectFromDay(dayIdx, Math.min(need, 10));
        if (got > 0) progressedThisRound = true;
      }
      if (!progressedThisRound) break;
    }

    // maxItems 제한
    const targetArticles = allArticles.slice(0, maxItems);
    if (targetArticles.length === 0) return;

    // Phase 2: 기사 본문 수집 (Playwright — JS 렌더링 필요)
    let browser: Browser | null = null;
    try {
      browser = await launchBrowser();
      const context = await createBrowserContext(browser);
      const page = await context.newPage();

      // 배치로 yield (10건 단위)
      const BATCH_SIZE = 10;
      for (let i = 0; i < targetArticles.length; i += BATCH_SIZE) {
        const batch = targetArticles.slice(i, i + BATCH_SIZE);
        const enriched: NaverArticle[] = [];

        for (const article of batch) {
          if (totalCollected >= maxItems) break;

          try {
            const content = await this.fetchArticleContent(page, article.url);
            article.content = content;
          } catch (err) {
            article.content = null;
            article.rawData.fetchError = err instanceof Error ? err.message : String(err);
          }
          await sleep(this.config.postDelay.min, this.config.postDelay.max);

          enriched.push(article);
          totalCollected++;
        }

        if (enriched.length > 0) {
          yield enriched;
        }
      }
    } finally {
      if (browser) await browser.close();
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
      const dateMatch = blockText.match(/(\d+)(분|시간|일)\s*전/);
      const publishedAt = dateMatch
        ? parseDateTextOrNull(`${dateMatch[1]}${dateMatch[2]} 전`)
        : null;

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
        /([가-힣A-Za-z0-9\s]+?)(?:\d+(?:분|시간|일)\s*전|네이버뉴스)/,
      );
      const publisher = pubMatch?.[1]?.trim() || '알 수 없음';
      const dateMatch = blockText.match(/(\d+)(분|시간|일)\s*전/);
      const publishedAt = dateMatch
        ? parseDateTextOrNull(`${dateMatch[1]}${dateMatch[2]} 전`)
        : null;

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
   * 날짜 범위를 일별로 분할 (과거 → 최신 순서)
   * 각 날짜에서 균등하게 기사를 수집하여 일별 트렌드 분석 정확도 향상
   */
  private splitIntoDays(startDate: string, endDate: string): Date[] {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const days: Date[] = [];
    const current = new Date(start);
    while (current <= end) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    if (days.length === 0) days.push(new Date(start));
    return days;
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
   * 기사 페이지에서 본문 추출 (Playwright 사용)
   */
  private async fetchArticleContent(page: Page, url: string): Promise<string | null> {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(500);

    const html = await page.content();
    const $ = cheerio.load(html);

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
        return content;
      }
    }

    return null;
  }
}
