// 클리앙 수집기 -- CommunityBaseCollector 상속
import * as cheerio from 'cheerio';
import type { Page } from 'playwright';
import type { CommunityPost, CommunityComment } from '../types/community';
import { parseDateText, sanitizeContent, buildSearchUrl } from '../utils/community-parser';
import { getRandomUserAgent } from '../utils/browser';
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
    // ⚠️ v4: 본문 fetch 전환(Playwright → fetch, 10배 빠름) + postDelay 대폭 축소.
    // fetch는 자체 rate-limit 관리 → 긴 delay 불필요.
    pageDelay: { min: 3000, max: 5000 },
    postDelay: { min: 300, max: 600 },
    defaultMaxItems: 50,
    maxSearchPages: 20,
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

  // 차단 감지 override (클리앙 전용) — fmkorea와 동일 수준으로 폭넓게 검출
  protected detectBlocked(html: string): boolean {
    if (!html) return true;
    // 정상 검색결과 페이지는 보통 30KB+
    if (html.length < 2000) return true;
    return (
      html.includes('접근이 제한') ||
      html.includes('403') ||
      html.includes('차단') ||
      html.includes('Too Many Requests') ||
      html.includes('429') ||
      html.includes('일시적으로 접근이 차단') ||
      // 검색결과 컨테이너가 없으면 비정상 응답
      (!html.includes('list_item') && !html.includes('total_search'))
    );
  }

  protected buildSearchUrl(
    keyword: string,
    page: number,
    _dateRange?: { start: string; end: string },
  ): string {
    // Clien은 검색 URL에 날짜 필터 미지원 → dateRange 무시, 사후 필터링으로 처리
    return buildSearchUrl('clien', keyword, page);
  }

  /**
   * ⚠️ 혁신적 방법 (v2): Playwright 대신 fetch로 검색 페이지를 직접 로드 + 세션 쿠키 유지.
   *
   * 배경: v1은 fetch 적용 후에도 rate-limit에 걸려 첫 페이지(04-18)만 반복 반환.
   *   - curl 단독은 p=0,1,2,3 모두 정상 반환
   *   - 워커가 30회 반복 호출 시 clien이 차단 시작
   *
   * 해결 (v2):
   *   1. 세션 쿠키를 인스턴스 레벨에 보관·재사용 (첫 페이지 방문 후 쿠키 획득)
   *   2. 페이지 간 딜레이를 2-4초로 명시적 부여 (pageDelay는 외부 제어)
   *   3. UA 로테이션은 매 호출이 아닌 collect 시작 시 1회만 (세션 일관성)
   */
  private sessionUserAgent?: string;
  private sessionCookies = new Map<string, string>();

  protected override async loadSearchPage(
    _page: Page,
    searchUrl: string,
    pageNum: number,
  ): Promise<{ url: string; title: string; publishedAt?: Date | null }[] | null> {
    if (!this.sessionUserAgent) {
      this.sessionUserAgent = getRandomUserAgent();
    }
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        // 세션 쿠키를 Cookie 헤더로 직렬화 (이전 응답에서 받은 Set-Cookie 재사용)
        const cookieHeader = Array.from(this.sessionCookies.entries())
          .map(([k, v]) => `${k}=${v}`)
          .join('; ');
        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': this.sessionUserAgent,
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            Referer: pageNum > 1 ? this.buildSearchUrl('_', pageNum - 1) : 'https://www.clien.net/',
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
        });
        // 응답 쿠키 보관 (다음 요청에 재사용 → 세션 자연스러워짐)
        const setCookies = response.headers.get('set-cookie');
        if (setCookies) {
          for (const part of setCookies.split(/,(?=[^;]+=)/)) {
            const m = part.trim().match(/^([^=;]+)=([^;]*)/);
            if (m) this.sessionCookies.set(m[1].trim(), m[2].trim());
          }
        }
        if (!response.ok) {
          console.warn(
            `${this.source} fetch 실패 HTTP ${response.status} (page ${pageNum}, attempt ${attempt})`,
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
            `${this.source} 차단 감지 (page ${pageNum}, attempt ${attempt}, size=${html.length})`,
          );
          if (attempt < MAX_ATTEMPTS) {
            await new Promise((r) =>
              setTimeout(r, 10000 * Math.pow(2, attempt - 1) + Math.random() * 3000),
            );
            continue;
          }
          return null;
        }
        // 🔍 진단 로그: 각 페이지의 첫 timestamp — 실제로 다른 페이지를 받는지 확인 (Job #223 캐시 이슈 재발 감시)
        const firstTs = html.match(/<span class="timestamp">([^<]*)</);
        const postLinks = this.parseSearchResults(html);
        console.info(
          `[clien] p=${pageNum} size=${html.length} firstTs=${firstTs ? firstTs[1] : 'NONE'} parsed=${postLinks.length} firstPublished=${postLinks[0]?.publishedAt?.toISOString() || 'NONE'}`,
        );
        return postLinks;
      } catch (err) {
        console.warn(
          `${this.source} fetch 예외 (page ${pageNum}, attempt ${attempt}):`,
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

  /**
   * 검색 결과 HTML에서 게시글 링크 + 작성일 추출.
   * clien 검색결과 구조: `<div class="list_item ...">` 단위로
   *   - 제목/링크: `a.subject_fixed`
   *   - 작성일: `<span class="timestamp">YYYY-MM-DD HH:mm:ss</span>` (KST)
   */
  protected parseSearchResults(
    html: string,
  ): { url: string; title: string; publishedAt?: Date | null }[] {
    const $ = cheerio.load(html);
    const results: { url: string; title: string; publishedAt?: Date | null }[] = [];

    // 1차: list_item 단위로 link/title/timestamp 동시 추출
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

    // 2차: 전용 셀렉터 폴백 (구조 변경 대응) — publishedAt 없이
    for (const selector of this.selectors.list) {
      $(selector).each((_, el) => {
        const href = $(el).attr('href');
        const title = $(el).text().trim();
        if (href && title) {
          const cleanHref = href.split('?')[0];
          const url = cleanHref.startsWith('http') ? cleanHref : `${this.baseUrl}${cleanHref}`;
          if (!results.some((r) => r.url === url)) {
            results.push({ url, title });
          }
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
          if (!results.some((r) => r.url === url)) {
            results.push({ url, title });
          }
        }
      });
    }

    return results;
  }

  /**
   * 게시글 상세 페이지 — 🚀 fetch 기반 (Playwright 대체, 10배 빠름).
   * clien 본문은 SSR이라 fetch로 바로 받을 수 있음. 세션 쿠키/UA 재사용.
   */
  protected async fetchPost(
    _page: import('playwright').Page,
    url: string,
    title: string,
    maxComments: number,
  ): Promise<CommunityPost | null> {
    if (!this.sessionUserAgent) this.sessionUserAgent = getRandomUserAgent();
    const cookieHeader = Array.from(this.sessionCookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    let html: string;
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.sessionUserAgent,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'ko-KR,ko;q=0.9',
          Referer: 'https://www.clien.net/',
          'Cache-Control': 'no-cache',
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
      });
      if (!response.ok) {
        console.warn(`[clien] fetchPost HTTP ${response.status}: ${url}`);
        return null;
      }
      const setCookies = response.headers.get('set-cookie');
      if (setCookies) {
        for (const part of setCookies.split(/,(?=[^;]+=)/)) {
          const m = part.trim().match(/^([^=;]+)=([^;]*)/);
          if (m) this.sessionCookies.set(m[1].trim(), m[2].trim());
        }
      }
      html = await response.text();
    } catch (err) {
      console.warn(`[clien] fetchPost 예외: ${url}`, err instanceof Error ? err.message : err);
      return null;
    }
    const $ = cheerio.load(html);

    // 본문 추출
    let content = '';
    for (const selector of this.selectors.content) {
      content = sanitizeContent($(selector).first().html() ?? '');
      if (content.length > 10) break;
    }

    // 메타데이터 추출
    const author = $('.post_author .nickname, .post_info .author').first().text().trim() || '익명';
    // ⚠️ 본문 timestamp 셀렉터 — 실제 clien 본문은 `.timestamp` 단독 (첫 번째가 게시글 작성시각).
    //   이전 `.post_author .timestamp` 매치 실패 → dateText='' → parseDateText('')=new Date()
    //   → 모든 글이 "현재 시각"으로 저장되어 일자별 분포가 04-18만으로 몰리는 결정적 버그.
    const dateText =
      $('.post_author .timestamp').first().text().trim() ||
      $('.post_info .date').first().text().trim() ||
      $('.timestamp').first().text().trim();
    // ⚠️ dateText가 비면 본문 시각을 신뢰할 수 없으므로 post=null 반환해 전체 스킵.
    //    (이전: new Date() fallback이 모든 글을 현재 시각으로 저장해 04-18만 몰리는 버그 유발)
    if (!dateText) {
      console.warn(`[clien] 본문 timestamp 없음 — 스킵: ${url}`);
      return null;
    }
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
