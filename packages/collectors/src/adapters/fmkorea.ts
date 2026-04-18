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
    // 에펨은 최신순 페이지네이션이 깊게 내려가야 과거 기사에 도달 (페이지 40~50 이상).
    // 무작위성 있는 딜레이로 안티봇 차단 회피.
    pageDelay: { min: 2500, max: 4500 },
    postDelay: { min: 800, max: 1500 },
    defaultMaxItems: 50,
    // 검색 결과 단계에서 publishedAt 사전 필터가 있으므로 페이지 많이 순회해도 본문 요청은 제한적.
    maxSearchPages: 80,
  };

  protected readonly selectors: SiteSelectors = {
    list: [
      'ul.searchResult li dt a', // IS 모듈 검색 결과 (ul > li > dl > dt > a)
      '.searchResult .title a', // 이전 구조 (fallback)
      '.search_list .title a', // 대체 검색 결과 셀렉터
      'li.searchResult a.title', // 리스트 아이템 형식
    ],
    content: ['.xe_content', '.rd_body .xe_content', '#xe_content'],
    comment: ['.fdb_lst_ul .xe_content', '.comment_content .xe_content'],
  };

  // 차단 감지 override (에펨코리아 전용)
  protected detectBlocked(html: string): boolean {
    return (
      html.includes('자동등록방지') ||
      html.includes('captcha') ||
      html.includes('접근이 제한') ||
      html.includes('에펨코리아 보안 시스템')
    );
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
      const hasLiteYear = cookies.some((c) => c.name === 'lite_year');
      if (hasLiteYear) {
        console.log(`[fmkorea] 보안 쿠키 확인됨 (lite_year) -- ${elapsed}ms 소요`);
        return true;
      }
    }

    console.warn(`[fmkorea] 보안 챌린지 쿠키 대기 타임아웃 (${maxWait}ms) -- 재시도`);
    return true;
  }

  protected buildSearchUrl(
    keyword: string,
    page: number,
    _dateRange?: { start: string; end: string },
  ): string {
    // 에펨 `s_date/e_date` 파라미터는 서버측에서 무시됨(실험으로 확인).
    // 모든 요청이 동일한 "관련도순 최신 결과"를 반환하므로 일자별 분할이 의미 없음.
    // 대신 페이지네이션으로 과거까지 내려가며 사전 날짜 필터를 사용.
    return buildSearchUrl('fmkorea', keyword, page);
  }

  // 에펨은 URL 레벨 날짜 필터 미지원 → 레거시 순차 + 사전 날짜 필터 경로 사용
  protected override supportsDateRangeSearch(): boolean {
    return false;
  }

  /**
   * 검색 결과 HTML에서 게시글 링크/제목/날짜 추출.
   * 에펨 검색 결과는 `<li>` 단위로 묶여 `<a href="/번호">제목</a>` + `<span class="time">YYYY-MM-DD HH:MM</span>`
   * 형태. 날짜를 함께 추출하면 본문 요청 전에 기간 필터링이 가능해져 안티봇 부담을 줄인다.
   */
  protected parseSearchResults(
    html: string,
  ): { url: string; title: string; publishedAt?: Date | null }[] {
    const $ = cheerio.load(html);
    const results: { url: string; title: string; publishedAt?: Date | null }[] = [];

    const parseFmTime = (text: string): Date | null => {
      // "YYYY-MM-DD HH:MM" (에펨 기본) 또는 "YYYY.MM.DD HH:MM"
      const m = text.trim().match(/(\d{4})[-.](\d{1,2})[-.](\d{1,2})\s+(\d{1,2}):(\d{1,2})/);
      if (!m) return null;
      // 로컬 타임존(컨테이너는 UTC지만 에펨 서버 시각은 KST)이라
      // +09:00을 명시해 안전하게 Date 생성.
      const iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}T${m[4].padStart(2, '0')}:${m[5].padStart(2, '0')}:00+09:00`;
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    // 1차: 검색 결과 <li> 블록을 통째로 순회하며 link + title + time 동시 추출
    $('ul.searchResult > li').each((_, li) => {
      const $li = $(li);
      const $a = $li.find('dt > a').first();
      const href = $a.attr('href');
      const title = $a.text().trim();
      if (!href || !title) return;
      const url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
      const timeText = $li.find('address .time').first().text().trim();
      const publishedAt = parseFmTime(timeText);
      results.push({ url, title, publishedAt });
    });
    if (results.length > 0) return results;

    // 2차: 전용 셀렉터 시도 (구조 변경 대응용 폴백)
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

    // 3차: 셀렉터 매칭 실패 시, 게시글 링크 패턴으로 폴백
    if (results.length === 0) {
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') ?? '';
        const title = $(el).text().trim();
        if (title.length > 5 && (href.match(/\/\d{6,}/) || href.includes('document_srl='))) {
          const url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
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
    const likeCount = parseInt(
      $('.voted_count, .vote_num').text().replace(/[^\d]/g, '') || '0',
      10,
    );

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
