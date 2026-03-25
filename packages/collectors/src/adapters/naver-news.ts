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
        // SDS 컴포넌트 렌더링 대기 (동적 해시 클래스 로드 필요)
        try {
          await page.waitForSelector('[class*="sds-comps-text-type-headline1"], .news_tit', { timeout: 5000 });
        } catch {
          // 셀렉터 대기 실패 시 고정 대기
        }
        await page.waitForTimeout(1500);

        const html = await page.content();
        const articles = this.parseSearchResults(html);

        if (articles.length === 0) break; // 검색 결과 없음 -- 종료

        // 각 기사의 본문 수집
        const enrichedArticles: NaverArticle[] = [];
        for (const article of articles) {
          if (totalCollected >= maxItems) break;

          // 네이버뉴스 URL 또는 원본 언론사 URL로 본문 수집 시도
          try {
            const content = await this.fetchArticleContent(page, article.url);
            article.content = content;
          } catch (err) {
            // 개별 기사 본문 수집 실패 시 content를 null로 유지 (부분 실패 허용)
            article.content = null;
            article.rawData.fetchError = err instanceof Error ? err.message : String(err);
          }
          await delay(500, 1000); // 기사 간 딜레이

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
   * 2026-03 기준: 네이버 SDS 디자인 시스템(sds-comps-*) 사용
   *
   * 전략:
   * 1차) headline1 셀렉터로 제목 요소를 찾고, 부모 a 태그에서 기사 URL 추출
   *      → n.news.naver.com 링크가 있으면 네이버뉴스 URL, 없으면 원본 언론사 URL
   * 2차) n.news.naver.com 링크 기반 탐색 (1차에서 못 잡은 기사 보완)
   * 3차) 레거시 셀렉터 폴백 (.news_area, .news_tit 등)
   */
  private parseSearchResults(html: string): NaverArticle[] {
    const $ = cheerio.load(html);
    const articles: NaverArticle[] = [];
    const seen = new Set<string>(); // URL 기반 중복 제거

    // --- 1차: sds-comps headline1 기반 (2026-03 네이버 구조) ---
    // headline1 요소의 부모 <a> 태그에 기사 URL이 있음
    $('[class*="sds-comps-text-type-headline1"]').each((_, el) => {
      // 제목 텍스트
      const title = $(el).text().trim();
      if (!title || title.length < 5) return;

      // 기사 URL: headline1을 감싸는 가장 가까운 <a> 태그
      const $parentLink = $(el).closest('a[href]');
      const articleUrl = $parentLink.attr('href') ?? '';
      if (!articleUrl || !articleUrl.startsWith('http')) return;

      // 중복 제거 (URL 기반)
      if (seen.has(articleUrl)) return;
      seen.add(articleUrl);

      // 기사 블록 탐색: headline1에서 상위로 올라가며 기사 컨테이너 찾기
      // sds-comps-full-layout 클래스 + 프로필(언론사) 정보가 있는 블록
      let $block = $(el);
      for (let i = 0; i < 8; i++) {
        $block = $block.parent();
        // 언론사 프로필 이미지가 있으면 기사 블록으로 판단
        if ($block.find('img[alt$="의 프로필 이미지"]').length > 0) break;
      }

      // 언론사: 프로필 이미지의 alt 텍스트에서 추출
      let publisher = '알 수 없음';
      const $pubImg = $block.find('img[alt$="의 프로필 이미지"]').first();
      if ($pubImg.length) {
        const alt = $pubImg.attr('alt') ?? '';
        publisher = alt.replace('의 프로필 이미지', '').trim() || publisher;
      }

      // 날짜: 블록 내 "N분 전", "N시간 전" 등
      const blockText = $block.text();
      const dateMatch = blockText.match(/(\d+)(분|시간|일)\s*전/);
      const publishedAt = dateMatch ? this.parseDateText(`${dateMatch[1]}${dateMatch[2]} 전`) : null;

      // 네이버뉴스 URL 확인: 같은 블록 안에 n.news.naver.com 링크가 있는지
      let naverUrl: string | null = null;
      $block.find('a[href*="n.news.naver.com"]').each((_, a) => {
        if (!naverUrl) {
          const href = $(a).attr('href') ?? '';
          if (parseNaverArticleUrl(href)) naverUrl = href;
        }
      });

      // sourceId 생성: 네이버뉴스 URL이 있으면 oid_aid, 없으면 URL 해시
      const parsed = naverUrl ? parseNaverArticleUrl(naverUrl) : null;
      const sourceId = parsed
        ? `${parsed.oid}_${parsed.aid}`
        : this.urlToSourceId(articleUrl);

      articles.push({
        sourceId,
        url: naverUrl ?? articleUrl, // 네이버뉴스 URL 우선 (댓글 수집용)
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
      // 1차에서 이미 수집한 기사인지 확인
      if (articles.some(a => a.sourceId === sourceId)) return;
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
        const segments = blockText.split('\n').map(s => s.trim()).filter(s => s.length > 15);
        title = segments[0] ?? blockText.substring(0, 100);
      }

      if (!title) return;

      const blockText = block.text();
      const pubMatch = blockText.match(/([가-힣A-Za-z0-9\s]+?)(?:\d+(?:분|시간|일)\s*전|네이버뉴스)/);
      const publisher = pubMatch?.[1]?.trim() || '알 수 없음';
      const dateMatch = blockText.match(/(\d+)(분|시간|일)\s*전/);
      const publishedAt = dateMatch ? this.parseDateText(`${dateMatch[1]}${dateMatch[2]} 전`) : null;

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
          sourceId, url, title, content: null, author: null,
          publisher, publishedAt: this.parseDateText(dateText),
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
   * URL에서 고유 sourceId 생성 (네이버뉴스 URL이 없는 기사용)
   * 원본 언론사 URL의 경로 부분을 ID로 사용
   */
  private urlToSourceId(url: string): string {
    try {
      const u = new URL(url);
      // 호스트 + 경로를 합쳐서 고유 ID 생성
      const pathId = u.pathname.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 80);
      return `ext_${u.hostname.replace(/\./g, '_')}_${pathId}`;
    } catch {
      return `ext_${url.substring(0, 100).replace(/[^a-zA-Z0-9]/g, '_')}`;
    }
  }

  /**
   * 기사 페이지에서 본문 추출
   */
  private async fetchArticleContent(page: Page, url: string): Promise<string | null> {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(500);

    const html = await page.content();
    const $ = cheerio.load(html);

    // 네이버 뉴스 + 원본 언론사 본문 셀렉터 (우선순위대로)
    const contentSelectors = [
      // 네이버 뉴스
      '#newsct_article', '.newsct_article', '#dic_area',
      // 일반 언론사 공통 패턴
      '#articeBody', '#articleBody', '.article_body', '.article-body',
      '#article-body', '#article_body', '.news_content', '.article_content',
      '.story-news', '#article_content', '.view_article', '#news_body',
      // 범용 article 태그
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
