// 클리앙 수집기 -- CommunityBaseCollector 상속
import * as cheerio from 'cheerio';
import type { CommunityPost, CommunityComment } from '../types/community';
import { parseDateText, sanitizeContent, buildSearchUrl } from '../utils/community-parser';
import { CommunityBaseCollector, type SiteSelectors } from './community-base-collector';
import type { BrowserCollectorConfig } from './browser-collector';

/**
 * 클리앙 수집기
 *
 * 403 보호가 강하므로 반드시 Playwright 사용 (Axios 차단됨).
 * 주요 게시판: park, news, cm_politics.
 * 반봇 딜레이가 가장 긴 수집기.
 */
export class ClienCollector extends CommunityBaseCollector {
  readonly source = 'clien';
  protected readonly baseUrl = 'https://www.clien.net';

  protected readonly config: BrowserCollectorConfig = {
    pageDelay: { min: 2000, max: 3500 },
    postDelay: { min: 1000, max: 1800 },
    defaultMaxItems: 50,
    maxSearchPages: 15,
  };

  protected readonly selectors: SiteSelectors = {
    list: [
      '.list_item a.subject_fixed', // 검색 결과 목록
      '.list_item a[href*="/service/board/"]', // 검색 결과 게시글 링크
      '.list-title a.subject_fixed', // 일반 게시판 목록 (fallback)
      '.list-row .list-title a', // 대체 목록 셀렉터
    ],
    content: ['.post_article', '.post_content', '#div_content'],
    comment: ['.comment_view .comment_content', '.comment_row .comment_content'],
  };

  // 차단 감지 override (클리앙 전용)
  protected detectBlocked(html: string): boolean {
    return html.includes('접근이 제한') || html.includes('403') || html.includes('차단');
  }

  protected buildSearchUrl(keyword: string, page: number): string {
    return buildSearchUrl('clien', keyword, page);
  }

  /** 검색 결과 HTML에서 게시글 링크 목록 추출 */
  protected parseSearchResults(html: string): { url: string; title: string }[] {
    const $ = cheerio.load(html);
    const results: { url: string; title: string }[] = [];

    // 1차: 전용 셀렉터 시도
    for (const selector of this.selectors.list) {
      $(selector).each((_, el) => {
        const href = $(el).attr('href');
        const title = $(el).text().trim();
        if (href && title) {
          // 검색 결과 URL에서 쿼리 파라미터(combine, q) 제거
          const cleanHref = href.split('?')[0];
          const url = cleanHref.startsWith('http') ? cleanHref : `${this.baseUrl}${cleanHref}`;
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
          const url = cleanHref.startsWith('http') ? cleanHref : `${this.baseUrl}${cleanHref}`;
          if (!results.some((r) => r.url === url)) {
            results.push({ url, title });
          }
        }
      });
    }

    return results;
  }

  /** 게시글 상세 페이지에서 본문 + 댓글 수집 */
  protected async fetchPost(
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
    for (const selector of this.selectors.content) {
      content = sanitizeContent($(selector).first().html() ?? '');
      if (content.length > 10) break;
    }

    // 메타데이터 추출
    const author = $('.post_author .nickname, .post_info .author').first().text().trim() || '익명';
    const dateText = $('.post_author .timestamp, .post_info .date').first().text().trim();
    const publishedAt = parseDateText(dateText);
    const viewCount = parseInt(
      $('.post_author .view_count, .view_count').text().replace(/[^\d]/g, '') || '0',
      10,
    );
    const likeCount = parseInt(
      $('.post_symph, .like_count').text().replace(/[^\d]/g, '') || '0',
      10,
    );

    // 게시판 이름 추출
    const boardName =
      $('.board_head h3, .board_name').text().trim() || this.extractBoardFromUrl(url);

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

    for (const selector of this.selectors.comment) {
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
