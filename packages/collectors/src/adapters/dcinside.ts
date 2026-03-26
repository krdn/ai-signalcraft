// DC갤러리 수집기 (Playwright + Cheerio)
import { type Browser } from 'playwright';
import { launchBrowser } from '../utils/browser';
import * as cheerio from 'cheerio';
import type { Collector, CollectionOptions } from './base';
import type { CommunityPost, CommunityComment } from '../types/community';
import { parseDateText, sleep, sanitizeContent, buildSearchUrl } from '../utils/community-parser';

// 페이지 간 딜레이 (반봇 대응)
const PAGE_DELAY = { min: 2000, max: 3000 };
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

// 검색 결과 페이지 셀렉터 (search.dcinside.com, DOM 변경 대응용 fallback 배열)
const LIST_SELECTORS = ['.sch_result_list a.tit_txt', '.sch_result_list li > a'];
// 본문 셀렉터
const CONTENT_SELECTORS = ['.write_div', '.writing_view_box', '#container .write_div'];
// 댓글 셀렉터
const COMMENT_SELECTORS = ['.reply_content .usertxt', '.cmt_txt_cont .usertxt'];

/**
 * DC갤러리 수집기
 *
 * Playwright로 검색 결과 페이지를 렌더링하고
 * Cheerio로 게시글/댓글을 파싱한다.
 * 마이너 갤러리(/mgallery/) 자동 감지.
 */
export class DCInsideCollector implements Collector<CommunityPost> {
  readonly source = 'dcinside';

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

        const searchUrl = buildSearchUrl('dcinside', options.keyword, pageNum);
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1500);

        const html = await page.content();
        const postLinks = this.parseSearchResults(html);

        if (postLinks.length === 0) break;

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
            console.warn(`DC 게시글 수집 실패 (${link.url}):`, err);
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

    // fallback 셀렉터 순회
    for (const selector of LIST_SELECTORS) {
      $(selector).each((_, el) => {
        const href = $(el).attr('href');
        const title = $(el).text().trim();
        if (href && title) {
          // 상대 URL -> 절대 URL
          const url = href.startsWith('http') ? href : `https://gall.dcinside.com${href}`;
          results.push({ url, title });
        }
      });
      if (results.length > 0) break;
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

    // 본문 추출 (fallback 셀렉터)
    let content = '';
    for (const selector of CONTENT_SELECTORS) {
      content = sanitizeContent($(selector).html() ?? '');
      if (content.length > 10) break;
    }

    // 메타데이터 추출
    const author = $('.gall_writer .nickname, .gall_writer .ip').first().text().trim() || '익명';
    const dateText = $('.gall_date').attr('title') || $('.gall_date').text().trim();
    const publishedAt = parseDateText(dateText);
    const viewCount = parseInt($('.gall_count').text().replace(/[^\d]/g, '') || '0', 10);
    const likeCount = parseInt($('.gall_reply_num, .up_num').text().replace(/[^\d]/g, '') || '0', 10);

    // 갤러리 이름 추출
    const boardName = $('h3.title, .gallview_head .title').text().trim() || this.extractBoardFromUrl(url);

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
        const $parent = $el.closest('.reply_info, .comment_dccon, li');
        const content = sanitizeContent($el.html() ?? '');
        if (!content) return;

        const author = $parent.find('.gall_writer .nickname, .ip').first().text().trim() || '익명';
        const dateText = $parent.find('.date_time').text().trim();
        const commentId = $parent.attr('data-no') || `${postSourceId}_c${i}`;
        const parentCommentId = $parent.attr('data-depth') === '1' ? null : $parent.attr('data-parent') || null;

        comments.push({
          sourceId: `dc_comment_${commentId}`,
          parentId: parentCommentId ? `dc_comment_${parentCommentId}` : null,
          content,
          author,
          likeCount: 0,
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
    const match = url.match(/no=(\d+)/);
    return match ? `dc_${match[1]}` : `dc_${Date.now()}`;
  }

  /** URL에서 갤러리 이름 추출 */
  private extractBoardFromUrl(url: string): string {
    const match = url.match(/id=([^&]+)/);
    return match ? match[1] : 'unknown';
  }
}
