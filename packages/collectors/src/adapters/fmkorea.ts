// 에펨코리아 수집기 -- CommunityBaseCollector 상속
import * as cheerio from 'cheerio';
import type { CommunityPost, CommunityComment } from '../types/community';
import { parseDateText, sanitizeContent, buildSearchUrl } from '../utils/community-parser';
import { CommunityBaseCollector, type SiteSelectors } from './community-base-collector';
import type { BrowserCollectorConfig } from './browser-collector';

/**
 * 에펨코리아 수집기
 *
 * Playwright로 검색 결과를 렌더링하고
 * Cheerio로 게시글/댓글을 파싱한다.
 * XE/Rhymix 기반 DOM 구조.
 */
export class FMKoreaCollector extends CommunityBaseCollector {
  readonly source = 'fmkorea';
  protected readonly baseUrl = 'https://www.fmkorea.com';

  protected readonly config: BrowserCollectorConfig = {
    pageDelay: { min: 1500, max: 3000 },
    postDelay: { min: 800, max: 1500 },
    defaultMaxItems: 50,
    maxSearchPages: 20,
  };

  protected readonly selectors: SiteSelectors = {
    list: [
      'ul.searchResult li dt a',        // IS 모듈 검색 결과 (ul > li > dl > dt > a)
      '.searchResult .title a',         // 이전 구조 (fallback)
      '.search_list .title a',          // 대체 검색 결과 셀렉터
      'li.searchResult a.title',        // 리스트 아이템 형식
    ],
    content: ['.xe_content', '.rd_body .xe_content', '#xe_content'],
    comment: ['.fdb_lst_ul .xe_content', '.comment_content .xe_content'],
  };

  // 차단 감지 override (에펨코리아 전용)
  protected detectBlocked(html: string): boolean {
    return html.includes('자동등록방지') || html.includes('captcha')
      || html.includes('접근이 제한') || html.includes('에펨코리아 보안 시스템');
  }

  /**
   * 에펨코리아 WASM 안티봇 보안 챌린지 통과
   * HTTP 430 응답 시 WASM 모듈(/mc/mc.php)이 lite_year 쿠키를 생성
   * 쿠키 설정 후 재접속하면 정상 페이지 반환
   */
  protected async handleSecurityChallenge(page: import('playwright').Page): Promise<boolean> {
    const html = await page.content();
    if (!html.includes('에펨코리아 보안 시스템') && !html.includes('/mc/mc.php')) {
      return false;
    }

    console.log(`[fmkorea] 보안 챌린지 감지 -- WASM 쿠키 생성 대기 중...`);

    // WASM 실행 완료를 기다림 (쿠키가 설정될 때까지 폴링)
    const maxWait = 15000;
    const pollInterval = 1000;
    let elapsed = 0;

    while (elapsed < maxWait) {
      await page.waitForTimeout(pollInterval);
      elapsed += pollInterval;

      const cookies = await page.context().cookies();
      const hasLiteYear = cookies.some(c => c.name === 'lite_year');
      if (hasLiteYear) {
        console.log(`[fmkorea] 보안 쿠키 확인됨 (lite_year) -- ${elapsed}ms 소요`);
        return true;
      }
    }

    console.warn(`[fmkorea] 보안 챌린지 쿠키 대기 타임아웃 (${maxWait}ms) -- 재시도`);
    return true;
  }

  protected buildSearchUrl(keyword: string, page: number): string {
    return buildSearchUrl('fmkorea', keyword, page);
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
          const url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
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
          const url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
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

    // 본문 추출
    let content = '';
    for (const selector of this.selectors.content) {
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

    for (const selector of this.selectors.comment) {
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
