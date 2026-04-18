// DC갤러리 수집기 -- CommunityBaseCollector 상속
import * as cheerio from 'cheerio';
import type { CommunityPost, CommunityComment } from '../types/community';
import {
  parseDateText,
  parseDateTextOrNull,
  sanitizeContent,
  buildSearchUrl,
} from '../utils/community-parser';
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
    // ⚠️ v2: 본문 fetch 전환 (댓글 AJAX는 Playwright fallback) + postDelay 축소.
    pageDelay: { min: 3000, max: 5000 },
    postDelay: { min: 400, max: 800 },
    defaultMaxItems: 50,
    maxSearchPages: 60,
  };

  protected readonly selectors: SiteSelectors = {
    list: ['.sch_result_list a.tit_txt', '.sch_result_list li > a'],
    content: ['.write_div', '.writing_view_box', '#container .write_div'],
    comment: ['.reply_content .usertxt', '.cmt_txt_cont .usertxt'],
  };

  // 차단 감지 override — fmkorea/clien과 동일 수준
  protected detectBlocked(html: string): boolean {
    if (!html) return true;
    if (html.length < 2000) return true;
    return (
      html.includes('Too Many Requests') ||
      html.includes('429') ||
      html.includes('접근이 제한') ||
      html.includes('차단') ||
      (!html.includes('sch_result_list') && !html.includes('integrate_schwrap'))
    );
  }

  protected buildSearchUrl(
    keyword: string,
    page: number,
    _dateRange?: { start: string; end: string },
  ): string {
    // DC는 검색 URL에 날짜 필터 미지원 → dateRange 무시, 사후 필터링으로 처리
    return buildSearchUrl('dcinside', keyword, page);
  }

  /**
   * 검색 결과 HTML에서 게시글 링크 + 작성일 추출.
   * search.dcinside.com 결과 구조: `<ul class="sch_result_list"><li>` 단위로
   *   - 제목/링크: `a.tit_txt`
   *   - 작성일: `<span class="date_time">YYYY.MM.DD HH:mm</span>` (KST)
   * 작성일을 동반 추출하면 본문 요청 전 사전 필터 + per-day cap이 활성화된다.
   */
  protected parseSearchResults(
    html: string,
  ): { url: string; title: string; publishedAt?: Date | null }[] {
    const $ = cheerio.load(html);
    const results: { url: string; title: string; publishedAt?: Date | null }[] = [];

    // 1차: 결과 <li> 블록을 순회하며 link + title + date_time 동시 추출
    $('ul.sch_result_list > li').each((_, li) => {
      const $li = $(li);
      const $a = $li.find('a.tit_txt').first();
      const href = $a.attr('href');
      const title = $a.text().trim();
      if (!href || !title) return;
      const url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
      const dateText = $li.find('span.date_time').first().text().trim();
      const publishedAt = parseDateTextOrNull(dateText);
      results.push({ url, title, publishedAt });
    });
    if (results.length > 0) return results;

    // 2차: 셀렉터 매칭 실패 시 폴백 (구조 변경 대응) — publishedAt 없이 진행
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

    return results;
  }

  /**
   * 게시글 상세 페이지 — 🚀 fetch 우선 (Playwright 대체).
   * DC 댓글은 AJAX 지연 로드라 fetch HTML엔 없을 수 있음 → 댓글 필요 시 Playwright fallback.
   */
  protected async fetchPost(
    page: import('playwright').Page,
    url: string,
    title: string,
    maxComments: number,
  ): Promise<CommunityPost | null> {
    let html = '';
    let usedPlaywright = false;
    // 1차: fetch 빠른 시도
    try {
      const cookies = await page
        .context()
        .cookies('https://gall.dcinside.com')
        .catch(() => []);
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'ko-KR,ko;q=0.9',
          Referer: 'https://gall.dcinside.com/',
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
      });
      if (response.ok) html = await response.text();
    } catch {
      /* Playwright fallback */
    }
    // 2차: fetch 실패 또는 댓글 AJAX 필요 → Playwright
    if (
      !html ||
      (maxComments > 0 && !html.includes('reply_content') && !html.includes('usertxt'))
    ) {
      usedPlaywright = true;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      const commentSelector = this.selectors.comment.join(', ');
      await page
        .waitForSelector(commentSelector, { timeout: 4000, state: 'attached' })
        .catch(() => undefined);
      await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => undefined);
      html = await page.content();
    }
    void usedPlaywright; // 디버깅 시 사용
    const $ = cheerio.load(html);

    // 본문 추출 (fallback 셀렉터)
    let content = '';
    for (const selector of this.selectors.content) {
      content = sanitizeContent($(selector).html() ?? '');
      if (content.length > 10) break;
    }

    // 메타데이터 추출
    const author = $('.gall_writer .nickname, .gall_writer .ip').first().text().trim() || '익명';
    // dcinside 본문: <span class="gall_date" title="2026-04-18 14:58:41">2026.04.18</span>
    // title 속성이 초 단위까지 정확하므로 우선 사용.
    const dateText = $('.gall_date').attr('title')?.trim() || $('.gall_date').text().trim();
    // ⚠️ dateText 비면 new Date() fallback 대신 스킵 (clien/fmkorea 동일 정책)
    if (!dateText) {
      console.warn(`[dcinside] 본문 gall_date 없음 — 스킵: ${url}`);
      return null;
    }
    const publishedAt = parseDateText(dateText);
    const viewCount = parseInt($('.gall_count').text().replace(/[^\d]/g, '') || '0', 10);
    const likeCount = parseInt(
      $('.gall_reply_num, .up_num').text().replace(/[^\d]/g, '') || '0',
      10,
    );

    // 갤러리 이름 추출
    const boardName =
      $('h3.title, .gallview_head .title').text().trim() || this.extractBoardFromUrl(url);

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
        const parentCommentId =
          $parent.attr('data-depth') === '1' ? null : $parent.attr('data-parent') || null;

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
