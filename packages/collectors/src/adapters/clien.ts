// 클리앙 수집기 (Playwright + Cheerio)
import { type Browser } from 'playwright';
import { launchBrowser } from '../utils/browser';
import * as cheerio from 'cheerio';
import type { Collector, CollectionOptions } from './base';
import type { CommunityPost, CommunityComment } from '../types/community';
import { parseDateText, sleep, sanitizeContent, buildSearchUrl } from '../utils/community-parser';

// 페이지 간 딜레이 (반봇 대응 -- 클리앙이 가장 엄격)
const PAGE_DELAY = { min: 3000, max: 5000 };
// 게시글 간 딜레이
const POST_DELAY = { min: 1500, max: 2500 };
// 기본 최대 수집 건수
const DEFAULT_MAX_ITEMS = 50;
// 최대 검색 페이지
const MAX_SEARCH_PAGES = 15;

// User-Agent 로테이션
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

// 게시글 목록 셀렉터 (검색 결과 페이지)
const LIST_SELECTORS = [
  '.list_item a.subject_fixed',     // 검색 결과 목록
  '.list_item a[href*="/service/board/"]',  // 검색 결과 게시글 링크
  '.list-title a.subject_fixed',    // 일반 게시판 목록 (fallback)
  '.list-row .list-title a',        // 대체 목록 셀렉터
];
// 본문 셀렉터
const CONTENT_SELECTORS = ['.post_article', '.post_content', '#div_content'];
// 댓글 셀렉터
const COMMENT_SELECTORS = ['.comment_view .comment_content', '.comment_row .comment_content'];

/**
 * 클리앙 수집기
 *
 * 403 보호가 강하므로 반드시 Playwright 사용 (Axios 차단됨).
 * 주요 게시판: park, news, cm_politics.
 * 반봇 딜레이가 가장 긴 수집기.
 */
export class ClienCollector implements Collector<CommunityPost> {
  readonly source = 'clien';

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

        const searchUrl = buildSearchUrl('clien', options.keyword, pageNum);
        try {
          await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        } catch (navErr) {
          console.warn(`Clien 검색 페이지 로드 실패 (page ${pageNum}):`, navErr);
          break;
        }
        // 검색 결과 렌더링 대기 (클리앙은 JS 렌더링이 느림)
        await page.waitForTimeout(2500 + Math.random() * 1000);

        const html = await page.content();
        const postLinks = this.parseSearchResults(html);

        if (postLinks.length === 0) {
          const blocked = html.includes('접근이 제한') || html.includes('403') || html.includes('차단');
          if (blocked) {
            console.warn('Clien 검색 차단 감지 — 수집 중단');
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
            console.warn(`Clien 게시글 수집 실패 (${link.url}):`, err);
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
          // 검색 결과 URL에서 쿼리 파라미터(combine, q) 제거
          const cleanHref = href.split('?')[0];
          const url = cleanHref.startsWith('http') ? cleanHref : `https://www.clien.net${cleanHref}`;
          if (!results.some((r) => r.url === url)) {
            results.push({ url, title });
          }
        }
      });
      if (results.length > 0) break;
    }

    // 2차: 셀렉터 매칭 실패 시 게시글 링크 패턴으로 폴백
    if (results.length === 0) {
      $('a[href*="/service/board/"]').each((_, el) => {
        const href = $(el).attr('href') ?? '';
        const title = $(el).text().trim();
        // 게시글 URL: /service/board/{board}/{id} 형태만
        if (title.length > 3 && href.match(/\/service\/board\/[^/]+\/\d+/)) {
          const cleanHref = href.split('?')[0];
          const url = cleanHref.startsWith('http') ? cleanHref : `https://www.clien.net${cleanHref}`;
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
    await page.waitForTimeout(1500);

    const html = await page.content();
    const $ = cheerio.load(html);

    // 본문 추출
    let content = '';
    for (const selector of CONTENT_SELECTORS) {
      content = sanitizeContent($(selector).first().html() ?? '');
      if (content.length > 10) break;
    }

    // 메타데이터 추출
    const author = $('.post_author .nickname, .post_info .author').first().text().trim() || '익명';
    const dateText = $('.post_author .timestamp, .post_info .date').first().text().trim();
    const publishedAt = parseDateText(dateText);
    const viewCount = parseInt($('.post_author .view_count, .view_count').text().replace(/[^\d]/g, '') || '0', 10);
    const likeCount = parseInt($('.post_symph, .like_count').text().replace(/[^\d]/g, '') || '0', 10);

    // 게시판 이름 추출
    const boardName = $('.board_head h3, .board_name').text().trim() || this.extractBoardFromUrl(url);

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
        const $parent = $el.closest('.comment_row, .comment_view');
        const content = sanitizeContent($el.html() ?? '');
        if (!content) return;

        const author = $parent.find('.nickname, .comment_nickname').first().text().trim() || '익명';
        const dateText = $parent.find('.timestamp, .comment_time').first().text().trim();
        const commentId = $parent.attr('data-comment-srl') || `${postSourceId}_c${i}`;
        const isReply = $parent.hasClass('re');
        const parentCommentId = isReply ? $parent.attr('data-parent-srl') || null : null;
        const symph = parseInt($parent.find('.comment_symph').text() || '0', 10);

        comments.push({
          sourceId: `cl_comment_${commentId}`,
          parentId: parentCommentId ? `cl_comment_${parentCommentId}` : null,
          content,
          author,
          likeCount: symph > 0 ? symph : 0,
          dislikeCount: symph < 0 ? Math.abs(symph) : 0,
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
    return match ? `cl_${match[1]}` : `cl_${Date.now()}`;
  }

  /** URL에서 게시판 이름 추출 */
  private extractBoardFromUrl(url: string): string {
    const match = url.match(/\/service\/board\/([^/?]+)/);
    return match ? match[1] : 'unknown';
  }
}
