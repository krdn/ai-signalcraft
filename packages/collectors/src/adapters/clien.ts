// 클리앙 수집기 -- CommunityBaseCollector 상속
import * as cheerio from 'cheerio';
import type { Page } from 'playwright';
import type { CommunityPost, CommunityComment } from '../types/community';
import { parseDateText, sanitizeContent, buildSearchUrl } from '../utils/community-parser';
import { getRandomUserAgent } from '../utils/browser';
import { CommunityBaseCollector, type SiteSelectors } from './community-base-collector';
import type { BrowserCollectorConfig } from './browser-collector';

export class ClienCollector extends CommunityBaseCollector {
  readonly source = 'clien';
  protected readonly baseUrl = 'https://www.clien.net';

  protected readonly config: BrowserCollectorConfig = {
    pageDelay: { min: 4000, max: 7000 },
    postDelay: { min: 500, max: 1000 },
    defaultMaxItems: 50,
    maxSearchPages: 20,
  };

  protected readonly selectors: SiteSelectors = {
    list: [
      '.list_item a.subject_fixed',
      '.list_item a[href*="/service/board/"]',
      '.list-title a.subject_fixed',
      '.list-row .list-title a',
    ],
    content: ['.post_article', '.post_content', '#div_content'],
    comment: ['.comment_row[data-role="comment-row"]'],
  };

  // 클리앙 검색 sort=recency는 최신순이지만 페이지 간 날짜 정렬이 엄밀하지 않아
  // dayWindow 경로에서 중간 날짜 누락 발생 → legacy 순차 경로 사용
  protected override sortedByDateDescending(): boolean {
    return false;
  }

  protected detectBlocked(html: string): boolean {
    if (!html) return true;
    if (html.length < 2000) return true;
    // 정상 콘텐츠 마커가 있으면 차단 아님 (본문/검색 모두 커버)
    const hasContent =
      html.includes('post_article') ||
      html.includes('post_content') ||
      html.includes('list_item') ||
      html.includes('total_search');
    if (hasContent) return false;
    // 콘텐츠 마커 없음 → 차단/에러 페이지로 판정
    return true;
  }

  protected buildSearchUrl(
    keyword: string,
    page: number,
    _dateRange?: { start: string; end: string },
  ): string {
    return buildSearchUrl('clien', keyword, page);
  }

  // --- 세션 관리 ---
  private sessionUserAgent?: string;
  private sessionCookies = new Map<string, string>();
  private consecutiveFetchFails = 0;
  private sessionInitialized = false;

  private saveCookiesFromResponse(response: Response): void {
    const setCookies = response.headers.get('set-cookie');
    if (setCookies) {
      for (const part of setCookies.split(/,(?=[^;]+=)/)) {
        const m = part.trim().match(/^([^=;]+)=([^;]*)/);
        if (m) this.sessionCookies.set(m[1].trim(), m[2].trim());
      }
    }
  }

  private buildFetchHeaders(pageNum?: number): Record<string, string> {
    if (!this.sessionUserAgent) this.sessionUserAgent = getRandomUserAgent();
    const cookieHeader = Array.from(this.sessionCookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    return {
      'User-Agent': this.sessionUserAgent,
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      Referer:
        pageNum && pageNum > 1 ? this.buildSearchUrl('_', pageNum - 1) : 'https://www.clien.net/',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    };
  }

  private resetSession(): void {
    this.sessionCookies.clear();
    this.sessionUserAgent = getRandomUserAgent();
    this.consecutiveFetchFails = 0;
    this.sessionInitialized = false;
    console.info(`[clien] 세션 리셋 — 새 UA + 쿠키 초기화`);
  }

  private async collectCookiesFromPage(page: Page): Promise<void> {
    try {
      const cookies = await page.context().cookies('https://www.clien.net');
      for (const c of cookies) this.sessionCookies.set(c.name, c.value);
      if (this.sessionCookies.size > 0) {
        console.info(`[clien] Playwright에서 쿠키 ${this.sessionCookies.size}개 확보`);
      }
    } catch {
      /* 쿠키 획득 실패 무시 */
    }
  }

  // --- 검색 페이지: 세션 초기화 후 fetch 우선 + Playwright fallback ---

  protected override async loadSearchPage(
    page: Page,
    searchUrl: string,
    pageNum: number,
  ): Promise<{ url: string; title: string; publishedAt?: Date | null }[] | null> {
    // 연속 실패 3회 → 세션 리셋
    if (this.consecutiveFetchFails >= 3) {
      this.resetSession();
      this.sessionInitialized = false;
    }

    // 세션 미초기화: Playwright로 첫 방문하여 쿠키 확보
    if (!this.sessionInitialized) {
      const initUrl = pageNum === 1 ? searchUrl : this.buildSearchUrl('_', 1);
      console.info(`[clien] 세션 초기화 — Playwright로 쿠키 확보 중`);
      try {
        await page.goto(initUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1500);
        await this.collectCookiesFromPage(page);
        if (this.sessionCookies.size > 0) {
          this.sessionInitialized = true;
          console.info(`[clien] 세션 초기화 완료 — 쿠키 ${this.sessionCookies.size}개 확보`);
        }
      } catch (err) {
        console.warn(`[clien] 세션 초기화 실패:`, err instanceof Error ? err.message : err);
      }
    }

    // 1차: fetch
    const fetchResult = await this.fetchSearchPageViaHttp(searchUrl, pageNum);
    if (fetchResult) {
      this.consecutiveFetchFails = 0;
      return fetchResult;
    }

    // 2차: Playwright fallback
    this.consecutiveFetchFails++;
    console.warn(
      `[clien] fetch 실패 → Playwright fallback (page ${pageNum}, fails=${this.consecutiveFetchFails})`,
    );
    const playwrightResult = await super.loadSearchPage(page, searchUrl, pageNum);
    if (playwrightResult) {
      await this.collectCookiesFromPage(page);
      this.consecutiveFetchFails = 0;
      this.sessionInitialized = true;
    }
    return playwrightResult;
  }

  private async fetchSearchPageViaHttp(
    searchUrl: string,
    pageNum: number,
  ): Promise<{ url: string; title: string; publishedAt?: Date | null }[] | null> {
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(searchUrl, { headers: this.buildFetchHeaders(pageNum) });
        this.saveCookiesFromResponse(response);

        if (!response.ok) {
          console.warn(
            `[clien] fetch HTTP ${response.status} (page ${pageNum}, attempt ${attempt})`,
          );
          if (attempt < MAX_ATTEMPTS) {
            await new Promise((r) =>
              setTimeout(r, 5000 * attempt + Math.random() * 3000 * attempt),
            );
            continue;
          }
          return null;
        }
        const html = await response.text();
        if (this.detectBlocked(html)) {
          console.warn(
            `[clien] 차단 감지 (page ${pageNum}, attempt ${attempt}, size=${html.length})`,
          );
          if (attempt < MAX_ATTEMPTS) {
            await new Promise((r) =>
              setTimeout(r, 10000 * Math.pow(2, attempt - 1) + Math.random() * 3000),
            );
            continue;
          }
          return null;
        }
        const firstTs = html.match(/<span class="timestamp">([^<]*)</);
        const postLinks = this.parseSearchResults(html);
        console.info(
          `[clien] p=${pageNum} size=${html.length} firstTs=${firstTs ? firstTs[1] : 'NONE'} parsed=${postLinks.length} firstPublished=${postLinks[0]?.publishedAt?.toISOString() || 'NONE'}`,
        );
        return postLinks;
      } catch (err) {
        console.warn(
          `[clien] fetch 예외 (page ${pageNum}, attempt ${attempt}):`,
          err instanceof Error ? err.message : err,
        );
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 5000 * attempt));
          continue;
        }
        return null;
      }
    }
    return null;
  }

  // --- 검색 결과 파싱 (메타데이터 강화) ---

  protected parseSearchResults(
    html: string,
  ): { url: string; title: string; publishedAt?: Date | null }[] {
    const $ = cheerio.load(html);
    const results: { url: string; title: string; publishedAt?: Date | null }[] = [];

    // 1차: list_item 단위로 link/title/timestamp + 메타데이터 동시 추출
    $('div.list_item[data-role="list-row"]').each((_, row) => {
      const $row = $(row);
      const $a = $row.find('a.subject_fixed').first();
      const href = $a.attr('href') ?? '';
      const title = ($a.attr('title') || $a.text() || '').trim();
      if (!href || !title) return;
      const cleanHref = href.split('?')[0];
      const url = cleanHref.startsWith('http') ? cleanHref : `${this.baseUrl}${cleanHref}`;
      if (results.some((r) => r.url === url)) return;
      const tsText = $row.find('span.timestamp').first().text().trim();
      const publishedAt = parseDateText(tsText);
      results.push({ url, title, publishedAt });
    });
    if (results.length > 0) return results;

    // 2차: 전용 셀렉터 폴백 (구조 변경 대응)
    for (const selector of this.selectors.list) {
      $(selector).each((_, el) => {
        const href = $(el).attr('href');
        const title = $(el).text().trim();
        if (href && title) {
          const cleanHref = href.split('?')[0];
          const url = cleanHref.startsWith('http') ? cleanHref : `${this.baseUrl}${cleanHref}`;
          if (!results.some((r) => r.url === url)) results.push({ url, title });
        }
      });
      if (results.length > 0) break;
    }

    // 3차: 패턴 폴백
    if (results.length === 0) {
      $('a[href*="/service/board/"]').each((_, el) => {
        const href = $(el).attr('href') ?? '';
        const title = $(el).text().trim();
        if (title.length > 3 && href.match(/\/service\/board\/[^/]+\/\d+/)) {
          const cleanHref = href.split('?')[0];
          const url = cleanHref.startsWith('http') ? cleanHref : `${this.baseUrl}${cleanHref}`;
          if (!results.some((r) => r.url === url)) results.push({ url, title });
        }
      });
    }

    return results;
  }

  // --- 게시글 상세: fetch 우선 + Playwright fallback ---

  protected async fetchPost(
    page: Page,
    url: string,
    title: string,
    maxComments: number,
  ): Promise<CommunityPost | null> {
    let html = '';

    // 1차: fetch
    try {
      const response = await fetch(url, {
        headers: {
          ...this.buildFetchHeaders(),
          Referer: 'https://www.clien.net/',
        },
      });
      this.saveCookiesFromResponse(response);
      if (response.ok) {
        const body = await response.text();
        if (!this.detectBlocked(body)) {
          html = body;
        } else {
          console.warn(`[clien] fetchPost 차단 감지: ${url}`);
        }
      } else {
        console.warn(`[clien] fetchPost HTTP ${response.status}: ${url}`);
      }
    } catch (err) {
      console.warn(`[clien] fetchPost 예외: ${url}`, err instanceof Error ? err.message : err);
    }

    // 2차: Playwright fallback
    if (!html) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1000);
        html = await page.content();
        await this.collectCookiesFromPage(page);
        if (this.detectBlocked(html)) {
          console.warn(`[clien] Playwright fallback도 차단: ${url}`);
          return null;
        }
        console.info(`[clien] Playwright fallback 성공: ${url}`);
      } catch (err) {
        console.warn(
          `[clien] Playwright fallback 실패: ${url}`,
          err instanceof Error ? err.message : err,
        );
        return null;
      }
    }

    return this.parsePostHtml(html, url, title, maxComments);
  }

  private parsePostHtml(
    html: string,
    url: string,
    title: string,
    maxComments: number,
  ): CommunityPost | null {
    const $ = cheerio.load(html);

    // 본문 추출
    let content = '';
    for (const selector of this.selectors.content) {
      content = sanitizeContent($(selector).first().html() ?? '');
      if (content.length > 10) break;
    }

    // 작성자
    const author =
      $('.post_author .nickname, .post_info .author, .post_contact .nickname')
        .first()
        .text()
        .trim() || '익명';

    // 본문 timestamp: .view_count.date에서 아이콘/수정일 제거 후 추출
    let dateText = '';
    const $dateSpan = $('.post_author .view_count.date').first();
    if ($dateSpan.length) {
      const clone = $dateSpan.clone();
      clone.find('.lastdate, .fa, [class^="fa-"]').remove();
      dateText = clone.text().trim();
    }
    if (!dateText) {
      // 폴백: .post_author 내의 .timestamp (일부 게시판에서 존재할 수 있음)
      dateText = $('.post_author .timestamp').first().text().trim();
    }
    if (!dateText) {
      dateText = $('.post_info .date').first().text().trim();
    }
    // 수정일 포함 시 분리: "2026-04-18 16:53:35  / 수정일: ..." → 원본만 사용
    if (dateText.includes('/')) {
      dateText = dateText.split('/')[0].trim();
    }

    if (!dateText) {
      console.warn(`[clien] 본문 timestamp 없음 — 스킵: ${url}`);
      return null;
    }
    const publishedAt = parseDateText(dateText);

    // 조회수: .view_count 중 .date가 아닌 것에서 추출
    const $viewElements = $('.post_author .view_count').not('.date').not('.ip');
    let viewCount = 0;
    if ($viewElements.length) {
      const viewText =
        $viewElements.find('strong').first().text().trim() || $viewElements.text().trim();
      viewCount = parseInt(viewText.replace(/[^\d]/g, '') || '0', 10);
    }

    // 추천수
    const likeCount = parseInt(
      $('.post_symph, .symph_count').text().replace(/[^\d]/g, '') || '0',
      10,
    );

    const boardName =
      $('.board_head h3, .board_name').text().trim() || this.extractBoardFromUrl(url);

    const sourceId = this.extractSourceId(url);
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

  // --- 댓글 파싱 (전면 재작성) ---

  private parseComments(
    $: cheerio.CheerioAPI,
    postSourceId: string,
    maxComments: number,
  ): CommunityComment[] {
    const comments: CommunityComment[] = [];
    let lastNonReplyCommentId: string | null = null;

    // 1차: data-role="comment-row" + data-comment-sn
    let $rows = $('.comment_row[data-role="comment-row"][data-comment-sn]');
    // 2차 폴백: data-comment-sn만 있는 경우
    if ($rows.length === 0) {
      $rows = $('.comment_row[data-comment-sn]');
    }

    $rows.each((i, el) => {
      if (comments.length >= maxComments) return;
      const $row = $(el);
      const commentSn = $row.attr('data-comment-sn') || '';
      if (!commentSn) return;

      // 댓글 내용: .comment_view[data-comment-view] 내의 HTML
      let $cv = $row.find(`.comment_view[data-comment-view="${commentSn}"]`).first();
      if (!$cv.length) $cv = $row.find('.comment_view').first();
      if (!$cv.length) return;

      // hidden input의 value에 원본 텍스트가 있음 (HTML 태그 없는 깨끗한 버전)
      const hiddenVal = $cv.find('input[data-comment-modify]').first().attr('value') ?? '';
      const rawHtml = $cv.clone().children('input').remove().end().html() ?? '';
      const content = hiddenVal ? hiddenVal.trim() : sanitizeContent(rawHtml);
      if (!content) return;

      // 작성자
      const authorNick =
        $row.find('.nickname span[title]').first().attr('title') ||
        $row.find('.nickname').first().text().trim() ||
        $row.attr('data-author-id') ||
        '익명';

      // timestamp: .comment_time 내의 .timestamp span에서 정확히 추출
      let rawDateText = $row.find('.comment_time .timestamp').first().text().trim();
      if (!rawDateText) {
        rawDateText = $row.find('.timestamp').first().text().trim();
      }
      // 수정일 포함 시 분리
      const dateText = rawDateText.includes('/') ? rawDateText.split('/')[0].trim() : rawDateText;

      // 추천수: strong[id^="setLikeCount_"]에서 정확한 숫자만
      const likeText = $row.find('strong[id^="setLikeCount_"]').first().text().trim();
      let likeCount = parseInt(likeText || '0', 10);
      if (Number.isNaN(likeCount)) likeCount = 0;

      // 대댓글: re 클래스 → DOM 순서로 부모 추적
      const isReply = $row.hasClass('re');
      const commentId = commentSn;
      let parentCommentId: string | null = null;
      if (isReply && lastNonReplyCommentId) {
        parentCommentId = lastNonReplyCommentId;
      }
      if (!isReply) {
        lastNonReplyCommentId = `cl_comment_${commentId}`;
      }

      comments.push({
        sourceId: `cl_comment_${commentId}`,
        parentId: parentCommentId,
        content,
        author: authorNick,
        likeCount,
        dislikeCount: 0,
        publishedAt: parseDateText(dateText),
        rawData: { dateText: rawDateText, authorId: $row.attr('data-author-id'), isReply },
      });
    });

    return comments;
  }

  private extractSourceId(url: string): string {
    const match = url.match(/\/(\d+)(?:\?|$)/);
    return match ? `cl_${match[1]}` : `cl_${Date.now()}`;
  }

  private extractBoardFromUrl(url: string): string {
    const match = url.match(/\/service\/board\/([^/?]+)/);
    return match ? match[1] : 'unknown';
  }
}
