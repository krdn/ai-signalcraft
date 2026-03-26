// DC갤러리 수집기 -- CommunityBaseCollector 상속
import * as cheerio from 'cheerio';
import type { CommunityPost, CommunityComment } from '../types/community';
import { parseDateText, sanitizeContent, buildSearchUrl } from '../utils/community-parser';
import { CommunityBaseCollector, type SiteSelectors } from './community-base-collector';
import type { BrowserCollectorConfig } from './browser-collector';

/**
 * DC갤러리 수집기
 *
 * Playwright로 검색 결과 페이지를 렌더링하고
 * Cheerio로 게시글/댓글을 파싱한다.
 * 마이너 갤러리(/mgallery/) 자동 감지.
 */
export class DCInsideCollector extends CommunityBaseCollector {
  readonly source = 'dcinside';
  protected readonly baseUrl = 'https://gall.dcinside.com';

  protected readonly config: BrowserCollectorConfig = {
    pageDelay: { min: 2000, max: 3000 },
    postDelay: { min: 1000, max: 2000 },
    defaultMaxItems: 50,
    maxSearchPages: 20,
  };

  protected readonly selectors: SiteSelectors = {
    list: ['.sch_result_list a.tit_txt', '.sch_result_list li > a'],
    content: ['.write_div', '.writing_view_box', '#container .write_div'],
    comment: ['.reply_content .usertxt', '.cmt_txt_cont .usertxt'],
  };

  protected buildSearchUrl(keyword: string, page: number): string {
    return buildSearchUrl('dcinside', keyword, page);
  }

  /** 검색 결과 HTML에서 게시글 링크 목록 추출 */
  protected parseSearchResults(html: string): { url: string; title: string }[] {
    const $ = cheerio.load(html);
    const results: { url: string; title: string }[] = [];

    // fallback 셀렉터 순회
    for (const selector of this.selectors.list) {
      $(selector).each((_, el) => {
        const href = $(el).attr('href');
        const title = $(el).text().trim();
        if (href && title) {
          // 상대 URL -> 절대 URL
          const url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
          results.push({ url, title });
        }
      });
      if (results.length > 0) break;
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
    await page.waitForTimeout(1000);

    const html = await page.content();
    const $ = cheerio.load(html);

    // 본문 추출 (fallback 셀렉터)
    let content = '';
    for (const selector of this.selectors.content) {
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

    for (const selector of this.selectors.comment) {
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
