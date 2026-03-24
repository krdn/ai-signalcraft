// 네이버 뉴스 기사 수집기 (Playwright + Cheerio)
import { chromium, type Browser, type Page } from 'playwright';
import * as cheerio from 'cheerio';
import type { Collector, CollectionOptions } from './base';
import { buildNaverSearchUrl, parseNaverArticleUrl } from '../utils/naver-parser';

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

// 페이지 간 딜레이 (rate limit 대응)
const PAGE_DELAY_MS = 1500;
// 기본 최대 수집 건수
const DEFAULT_MAX_ITEMS = 100;
// 네이버 검색 최대 페이지 (약 400건 / 40페이지)
const MAX_SEARCH_PAGES = 40;

/**
 * 랜덤 딜레이 (min ~ max ms)
 */
function delay(minMs: number, maxMs?: number): Promise<void> {
  const ms = maxMs ? minMs + Math.random() * (maxMs - minMs) : minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * NaverNewsCollector
 *
 * Playwright로 네이버 뉴스 검색 결과 페이지를 렌더링하고
 * Cheerio로 기사 목록을 파싱한다.
 * AsyncGenerator로 페이지 단위(최대 10건)로 yield한다.
 */
export class NaverNewsCollector implements Collector<NaverArticle> {
  readonly source = 'naver-news';

  /**
   * 키워드 기반 네이버 뉴스 기사 수집
   * 페이지 단위(10건)로 yield
   */
  async *collect(options: CollectionOptions): AsyncGenerator<NaverArticle[], void, unknown> {
    const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS;
    let totalCollected = 0;
    let browser: Browser | null = null;

    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
      const page = await context.newPage();

      for (let pageNum = 1; pageNum <= MAX_SEARCH_PAGES; pageNum++) {
        if (totalCollected >= maxItems) break;

        const searchUrl = buildNaverSearchUrl({
          keyword: options.keyword,
          startDate: options.startDate,
          endDate: options.endDate,
          page: pageNum,
          sort: 1, // 최신순
        });

        await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
        // 검색 결과 렌더링 대기
        await page.waitForTimeout(1000);

        const html = await page.content();
        const articles = this.parseSearchResults(html);

        if (articles.length === 0) break; // 검색 결과 없음 -- 종료

        // 각 기사의 본문 수집
        const enrichedArticles: NaverArticle[] = [];
        for (const article of articles) {
          if (totalCollected >= maxItems) break;

          // n.news.naver.com 링크가 있는 경우에만 본문 수집 시도
          const parsed = parseNaverArticleUrl(article.url);
          if (parsed) {
            try {
              const content = await this.fetchArticleContent(page, article.url);
              article.content = content;
            } catch (err) {
              // 개별 기사 본문 수집 실패 시 content를 null로 유지 (부분 실패 허용)
              article.content = null;
              article.rawData.fetchError = err instanceof Error ? err.message : String(err);
            }
            await delay(500, 1000); // 기사 간 딜레이
          }

          enrichedArticles.push(article);
          totalCollected++;
        }

        if (enrichedArticles.length > 0) {
          yield enrichedArticles;
        }

        // 페이지 간 딜레이 (rate limit 대응)
        await delay(PAGE_DELAY_MS, PAGE_DELAY_MS + 500);
      }
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * 검색 결과 HTML에서 기사 목록 파싱
   */
  private parseSearchResults(html: string): NaverArticle[] {
    const $ = cheerio.load(html);
    const articles: NaverArticle[] = [];

    // 네이버 뉴스 검색 결과의 기사 블록
    $('.news_area, .news_wrap, .bx').each((_, element) => {
      const $el = $(element);

      // 기사 제목과 URL 추출
      const $titleLink = $el.find('.news_tit, a.news_tit').first();
      const title = $titleLink.text().trim();
      const url = $titleLink.attr('href') ?? '';

      if (!title || !url) return;

      // 언론사 추출
      const publisher =
        $el.find('.info.press, .info_group .press, .news_info .info.press').first().text().trim() || '알 수 없음';

      // 날짜 추출
      const dateText = $el.find('.info_group span.info').last().text().trim();
      const publishedAt = this.parseDateText(dateText);

      // oid/aid 추출하여 sourceId 생성
      const parsed = parseNaverArticleUrl(url);
      const sourceId = parsed ? `${parsed.oid}_${parsed.aid}` : url;

      articles.push({
        sourceId,
        url,
        title,
        content: null, // 본문은 별도로 수집
        author: null,
        publisher,
        publishedAt,
        rawData: { dateText },
      });
    });

    return articles;
  }

  /**
   * 기사 페이지에서 본문 추출
   */
  private async fetchArticleContent(page: Page, url: string): Promise<string | null> {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(500);

    const html = await page.content();
    const $ = cheerio.load(html);

    // 네이버 뉴스 본문 셀렉터 (여러 패턴 대응)
    const contentSelectors = ['#newsct_article', '.newsct_article', '#dic_area', '#articeBody', '.article_body'];

    for (const selector of contentSelectors) {
      const content = $(selector).text().trim();
      if (content && content.length > 50) {
        return content;
      }
    }

    return null;
  }

  /**
   * 날짜 텍스트를 Date 객체로 변환
   * "2026.03.24." 또는 "3시간 전" 등의 형식을 처리
   */
  private parseDateText(text: string): Date | null {
    if (!text) return null;

    // YYYY.MM.DD. 형식
    const dateMatch = text.match(/(\d{4})\.(\d{2})\.(\d{2})/);
    if (dateMatch) {
      return new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`);
    }

    // "N시간 전", "N분 전", "N일 전" 형식
    const relativeMatch = text.match(/(\d+)(시간|분|일)\s*전/);
    if (relativeMatch) {
      const now = new Date();
      const amount = parseInt(relativeMatch[1], 10);
      const unit = relativeMatch[2];
      if (unit === '시간') now.setHours(now.getHours() - amount);
      else if (unit === '분') now.setMinutes(now.getMinutes() - amount);
      else if (unit === '일') now.setDate(now.getDate() - amount);
      return now;
    }

    return null;
  }
}
