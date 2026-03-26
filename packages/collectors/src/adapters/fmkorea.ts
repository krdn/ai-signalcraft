// 에펨코리아 수집기 (Playwright + Cheerio)
import { type Browser } from 'playwright';
import { launchBrowser } from '../utils/browser';
import * as cheerio from 'cheerio';
import type { Collector, CollectionOptions } from './base';
import type { CommunityPost, CommunityComment } from '../types/community';
import { parseDateText, sleep, sanitizeContent, buildSearchUrl } from '../utils/community-parser';

// 페이지 간 딜레이 (반봇 대응)
const PAGE_DELAY = { min: 2000, max: 4000 };
// 게시글 간 딜레이
const POST_DELAY = { min: 1000, max: 2000 };
// 기본 최대 수집 건수
const DEFAULT_MAX_ITEMS = 50;
// 최대 검색 페이지
const MAX_SEARCH_PAGES = 20;

// User-Agent 로테이션
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

// 게시글 목록 셀렉터 (XE/Rhymix 통합 검색 결과)
const LIST_SELECTORS = [
  '.searchResult .title a',         // IS 모듈 검색 결과
  '.search_list .title a',          // 대체 검색 결과 셀렉터
  'li.searchResult a.title',        // 리스트 아이템 형식
  '.fm_best_widget li a.title',     // 위젯 형식 (fallback)
];
// 본문 셀렉터
const CONTENT_SELECTORS = ['.xe_content', '.rd_body .xe_content', '#xe_content'];
// 댓글 셀렉터
const COMMENT_SELECTORS = ['.fdb_lst_ul .xe_content', '.comment_content .xe_content'];

/**
 * 에펨코리아 수집기
 *
 * Playwright로 검색 결과를 렌더링하고
 * Cheerio로 게시글/댓글을 파싱한다.
 * XE/Rhymix 기반 DOM 구조.
 */
export class FMKoreaCollector implements Collector<CommunityPost> {
  readonly source = 'fmkorea';

  async *collect(options: CollectionOptions): AsyncGenerator<CommunityPost[], void, unknown> {
    const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS;
    const maxComments = options.maxComments ?? 100;
    let totalCollected = 0;
    let browser: Browser | null = null;

    try {
      browser = await launchBrowser();
      const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
      const context = await browser.newContext({
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
        userAgent,
      });
      const page = await context.newPage();

      for (let pageNum = 1; pageNum <= MAX_SEARCH_PAGES; pageNum++) {
        if (totalCollected >= maxItems) break;

        const searchUrl = buildSearchUrl('fmkorea', options.keyword, pageNum);
        try {
          await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        } catch (navErr) {
          console.warn(`FM 검색 페이지 로드 실패 (page ${pageNum}):`, navErr);
          break;
        }
        // 검색 결과 렌더링 대기 (반봇 대응)
        await page.waitForTimeout(2000 + Math.random() * 1000);

        const html = await page.content();
        const postLinks = this.parseSearchResults(html);

        if (postLinks.length === 0) {
          // 검색 결과가 없는 경우 vs 차단된 경우 구분 로그
          const blocked = html.includes('자동등록방지') || html.includes('captcha') || html.includes('접근이 제한');
          if (blocked) {
            console.warn('FM 검색 차단 감지 — 수집 중단');
          }
          break;
        }

        const posts: CommunityPost[] = [];
        for (const link of postLinks) {
          if (totalCollected >= maxItems) break;

          try {
            const post = await this.fetchPost(page, link.url, link.title, maxComments);
            if (post) {
              posts.push(post);
              totalCollected++;
            }
          } catch (err) {
            // 개별 게시글 수집 실패 시 건너뜀 (부분 실패 허용)
            console.warn(`FM 게시글 수집 실패 (${link.url}):`, err);
          }
          await sleep(POST_DELAY.min, POST_DELAY.max);
        }

        if (posts.length > 0) {
          yield posts;
        }

        await sleep(PAGE_DELAY.min, PAGE_DELAY.max);
      }
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /** 검색 결과 HTML에서 게시글 링크 목록 추출 */
  private parseSearchResults(html: string): { url: string; title: string }[] {
    const $ = cheerio.load(html);
    const results: { url: string; title: string }[] = [];

    // 1차: 전용 셀렉터 시도
    for (const selector of LIST_SELECTORS) {
      $(selector).each((_, el) => {
        const href = $(el).attr('href');
        const title = $(el).text().trim();
        if (href && title) {
          const url = href.startsWith('http') ? href : `https://www.fmkorea.com${href}`;
          results.push({ url, title });
        }
      });
      if (results.length > 0) break;
    }

    // 2차: 셀렉터 매칭 실패 시, 게시글 링크 패턴으로 폴백
    if (results.length === 0) {
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') ?? '';
        const title = $(el).text().trim();
        // 에펨코리아 게시글 URL 패턴: /숫자 또는 /index.php?document_srl=숫자
        if (title.length > 5 && (href.match(/\/\d{6,}/) || href.includes('document_srl='))) {
          const url = href.startsWith('http') ? href : `https://www.fmkorea.com${href}`;
          // 중복 제거
          if (!results.some((r) => r.url === url)) {
            results.push({ url, title });
          }
        }
      });
    }

    return results;
  }

  /** 게시글 상세 페이지에서 본문 + 댓글 수집 */
  private async fetchPost(
    page: import('playwright').Page,
    url: string,
    title: string,
    maxComments: number,
  ): Promise<CommunityPost | null> {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1000);

    const html = await page.content();
    const $ = cheerio.load(html);

    // 본문 추출
    let content = '';
    for (const selector of CONTENT_SELECTORS) {
      content = sanitizeContent($(selector).first().html() ?? '');
      if (content.length > 10) break;
    }

    // 메타데이터 추출
    const author = $('.member_plate, .author').first().text().trim() || '익명';
    const dateText = $('.date, .regdate, .side .date').first().text().trim();
    const publishedAt = parseDateText(dateText);
    const viewCount = parseInt($('.count').text().replace(/[^\d]/g, '') || '0', 10);
    const likeCount = parseInt($('.voted_count, .vote_num').text().replace(/[^\d]/g, '') || '0', 10);

    // 게시판 이름 추출
    const boardName = $('h1.page_name, .board_name').text().trim() || this.extractBoardFromUrl(url);

    // 게시글 ID 추출
    const sourceId = this.extractSourceId(url);

    // 댓글 수집
    const comments = this.parseComments($, sourceId, maxComments);

    return {
      sourceId,
      url,
      title,
      content: content || title,
      author,
      boardName,
      publishedAt,
      viewCount,
      commentCount: comments.length,
      likeCount,
      rawData: { dateText, originalUrl: url },
      comments,
    };
  }

  /** HTML에서 댓글 파싱 */
  private parseComments(
    $: cheerio.CheerioAPI,
    postSourceId: string,
    maxComments: number,
  ): CommunityComment[] {
    const comments: CommunityComment[] = [];

    for (const selector of COMMENT_SELECTORS) {
      $(selector).each((i, el) => {
        if (comments.length >= maxComments) return;

        const $el = $(el);
        const $parent = $el.closest('li, .fdb_itm');
        const content = sanitizeContent($el.html() ?? '');
        if (!content) return;

        const author = $parent.find('.member_plate, .author').first().text().trim() || '익명';
        const dateText = $parent.find('.date, .regdate').text().trim();
        const commentId = $parent.attr('id')?.replace('comment_', '') || `${postSourceId}_c${i}`;
        const depth = $parent.hasClass('fdb_itm_answer') ? '1' : '0';
        const parentCommentId = depth === '1' ? $parent.attr('data-parent') || null : null;

        comments.push({
          sourceId: `fm_comment_${commentId}`,
          parentId: parentCommentId ? `fm_comment_${parentCommentId}` : null,
          content,
          author,
          likeCount: parseInt($parent.find('.voted_count').text() || '0', 10),
          dislikeCount: 0,
          publishedAt: parseDateText(dateText),
          rawData: { dateText },
        });
      });
      if (comments.length > 0) break;
    }

    return comments;
  }

  /** URL에서 게시글 ID 추출 */
  private extractSourceId(url: string): string {
    const match = url.match(/\/(\d+)(?:\?|$)/);
    return match ? `fm_${match[1]}` : `fm_${Date.now()}`;
  }

  /** URL에서 게시판 이름 추출 */
  private extractBoardFromUrl(url: string): string {
    const match = url.match(/mid=([^&]+)/);
    return match ? match[1] : 'unknown';
  }
}
