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
    // ⚠️ v3: 검색 페이지도 fetch 전환 (쿠키 확보 후) → pageDelay 대폭 단축 가능.
    // 본문/검색 모두 fetch이면 페이지당 ~500ms fetch + 2-3초 delay = 훨씬 빠름.
    pageDelay: { min: 2000, max: 3500 },
    postDelay: { min: 400, max: 800 },
    defaultMaxItems: 50,
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

  // 차단 감지 override (에펨코리아 전용) — 다양한 차단 신호를 폭넓게 검출
  protected detectBlocked(html: string): boolean {
    if (!html) return true;
    // 응답이 비정상적으로 짧으면 차단/에러 페이지로 간주 (정상 검색결과는 보통 30KB+)
    if (html.length < 2000) return true;
    // 명시적 차단/에러 신호
    if (
      html.includes('자동등록방지') ||
      html.includes('captcha') ||
      html.includes('접근이 제한') ||
      html.includes('에펨코리아 보안 시스템') ||
      html.includes('Too Many Requests') ||
      html.includes('일시적으로 접근이 차단')
    ) {
      return true;
    }
    // 정상 검색 결과 마커 확인 (fetch 응답은 HTML 구조가 Playwright와 다를 수 있음)
    const hasSearchMarker =
      html.includes('searchResult') ||
      html.includes('search_list') ||
      html.includes('is_keyword') ||
      html.includes('act=IS') ||
      html.includes('document_srl');
    if (hasSearchMarker) return false;
    // 검색 결과 마커도 없고 30KB 미만이면 비정상
    if (html.length < 30000) return true;
    // 30KB+면 정상 페이지일 가능성이 높음 (다른 콘텐츠 포함)
    return false;
  }

  /**
   * 에펨코리아 WASM 안티봇 보안 챌린지 통과
   * HTTP 430 응답 시 WASM 모듈(/mc/mc.php)이 lite_year 쿠키를 생성
   * 쿠키 설정 후 재접속하면 정상 페이지 반환
   */
  protected async handleSecurityChallenge(page: import('playwright').Page): Promise<boolean> {
    // page.content()는 페이지가 네비게이션 중이면 "Unable to retrieve content..."로 throw된다.
    // 챌린지 페이지 자체가 리다이렉트/스크립트 네비를 발생시키는 경우가 있어 방어 필요.
    // 실패 시 false(챌린지 아님)로 반환해 상위가 정상 흐름으로 이어가도록 한다.
    let html: string;
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
      html = await page.content();
    } catch (err) {
      console.warn(
        `[fmkorea] 챌린지 감지 단계에서 content() 실패 — 챌린지 아님으로 처리: ${
          err instanceof Error ? err.message : err
        }`,
      );
      return false;
    }
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
    dateRange?: { start: string; end: string },
  ): string {
    return buildSearchUrl('fmkorea', keyword, page, dateRange);
  }

  // 에펨코리아 search.php는 s_date/e_date 파라미터로 날짜 범위 필터 지원
  protected override supportsDateRangeSearch(): boolean {
    return true;
  }

  /**
   * 🚀 속도 개선: 검색 페이지도 fetch로 전환 (Playwright 대체).
   *
   * 전략:
   * 1. 첫 페이지: Playwright로 방문해 lite_year 쿠키 확보 (WASM 챌린지 통과)
   * 2. 이후 페이지: 획득한 쿠키를 fetch 헤더에 실어 HTTP 직접 호출
   *    - fetch는 Playwright 대비 10배 빠름
   *    - 차단 감지(HTTP 430 등) 시 Playwright fallback
   */
  private fmCookies = new Map<string, string>();
  private fmCookiesReady = false;

  protected override async loadSearchPage(
    page: import('playwright').Page,
    searchUrl: string,
    pageNum: number,
  ): Promise<{ url: string; title: string; publishedAt?: Date | null }[] | null> {
    // 1차: fetch 시도 (쿠키 확보 후)
    if (this.fmCookiesReady) {
      const result = await this.fetchSearchPage(searchUrl, pageNum);
      if (result) return result;
      // fetch 실패 → Playwright fallback (쿠키 갱신 포함)
      console.warn(`[fmkorea] fetch 실패 → Playwright fallback (page ${pageNum})`);
      this.fmCookiesReady = false;
    }
    // 2차: Playwright 경로 (첫 방문 또는 fetch 실패 복구)
    const result = await super.loadSearchPage(page, searchUrl, pageNum);
    // Playwright가 성공했으면 쿠키 수집해서 이후 fetch에 사용
    if (result) {
      try {
        const cookies = await page.context().cookies('https://www.fmkorea.com');
        this.fmCookies.clear();
        for (const c of cookies) this.fmCookies.set(c.name, c.value);
        if (this.fmCookies.has('lite_year') || this.fmCookies.size > 0) {
          this.fmCookiesReady = true;
          console.info(`[fmkorea] 쿠키 확보 완료 (${this.fmCookies.size}개) — 이후 fetch 사용`);
        }
      } catch {
        /* 쿠키 획득 실패 → Playwright 계속 사용 */
      }
    }
    return result;
  }

  /**
   * fetch 기반 검색 페이지 로드 (쿠키 확보 후에만 호출).
   * 차단/실패 시 null 반환하여 상위에서 Playwright fallback 처리.
   */
  private async fetchSearchPage(
    searchUrl: string,
    pageNum: number,
  ): Promise<{ url: string; title: string; publishedAt?: Date | null }[] | null> {
    try {
      const cookieHeader = Array.from(this.fmCookies.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9',
          Referer: 'https://www.fmkorea.com/',
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
      });
      if (!response.ok) {
        console.warn(`[fmkorea] fetch HTTP ${response.status} (page ${pageNum})`);
        return null;
      }
      const html = await response.text();
      // 응답 쿠키 갱신 (Set-Cookie 헤더가 오면)
      const setCookies = response.headers.get('set-cookie');
      if (setCookies) {
        for (const part of setCookies.split(/,(?=[^;]+=)/)) {
          const m = part.trim().match(/^([^=;]+)=([^;]*)/);
          if (m) this.fmCookies.set(m[1].trim(), m[2].trim());
        }
      }
      // 차단 감지
      if (this.detectBlocked(html)) {
        console.warn(`[fmkorea] fetch 차단 감지 (page ${pageNum}, size=${html.length})`);
        return null;
      }
      return this.parseSearchResults(html);
    } catch (err) {
      console.warn(
        `[fmkorea] fetch 예외 (page ${pageNum}):`,
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }

  /**
   * 검색 결과 HTML에서 게시글 링크/제목/날짜 추출.
   * 에펨 검색 결과는 `<li>` 단위로 묶여 `<a href="/번호">제목</a>` + `<span class="time">YYYY-MM-DD HH:MM</span>`
   * 형태. 날짜를 함께 추출하면 본문 요청 전에 기간 필터링이 가능해져 안티봇 부담을 줄인다.
   */
  protected parseSearchResults(html: string): {
    url: string;
    title: string;
    publishedAt?: Date | null;
    author?: string;
    recomCount?: number;
    commentCount?: number;
  }[] {
    const $ = cheerio.load(html);
    const results: {
      url: string;
      title: string;
      publishedAt?: Date | null;
      author?: string;
      recomCount?: number;
      commentCount?: number;
    }[] = [];

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

      const author = $li.find('address > strong').first().text().trim() || undefined;
      const recomText = $li.find('.recomNum').first().text().trim();
      const recomCount = recomText ? parseInt(recomText, 10) : undefined;
      const commentText = $li.find('.reply em').first().text().trim();
      const commentCount = commentText ? parseInt(commentText, 10) : undefined;

      results.push({ url, title, publishedAt, author, recomCount, commentCount });
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

  /**
   * 게시글 상세 페이지 — 🚀 fetch 우선 (Playwright 대체, 10배 빠름).
   * 차단 감지 시 Playwright fallback (WASM lite_year 챌린지 필요 케이스).
   */
  protected async fetchPost(
    page: import('playwright').Page,
    url: string,
    title: string,
    maxComments: number,
  ): Promise<CommunityPost | null> {
    let html = '';
    // 1차: fetch로 빠르게 시도
    try {
      const cookies = await page
        .context()
        .cookies('https://www.fmkorea.com')
        .catch(() => []);
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'ko-KR,ko;q=0.9',
          Referer: 'https://www.fmkorea.com/',
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
      });
      if (response.ok) {
        html = await response.text();
        // 차단 감지 → Playwright fallback
        if (this.detectBlocked(html) || html.length < 3000) html = '';
      }
    } catch {
      /* fetch 실패 시 Playwright fallback */
    }
    // 2차: Playwright fallback (WASM 챌린지 등 브라우저 필요 케이스)
    // page.content() race 방어: 네비게이션 완료 대기 + 실패 시 null 반환.
    if (!html) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(1000);
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
        html = await page.content();
      } catch (err) {
        console.warn(
          `[fmkorea] fetchPost Playwright fallback 실패 (${url}): ${
            err instanceof Error ? err.message : err
          }`,
        );
        return null;
      }
    }
    const $ = cheerio.load(html);

    // 본문 추출 (이미지/영상만 글은 미디어 참조 보강)
    const content = this.extractContent($);

    // 메타데이터 추출
    const author = $('.member_plate, .author').first().text().trim() || '익명';
    // 실제 fmkorea 본문: <span class="date m_no">2026.04.18 14:16</span>
    const dateText =
      $('.date').first().text().trim() ||
      $('.regdate').first().text().trim() ||
      $('.side .date').first().text().trim();
    // ⚠️ dateText가 비면 new Date() fallback 대신 null → post=null 반환으로 스킵
    //    (clien과 동일: 파싱 실패 시 현재 시각 저장으로 인한 일자 몰림 방지)
    if (!dateText) {
      console.warn(`[fmkorea] 본문 date 없음 — 스킵: ${url}`);
      return null;
    }
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

    // 댓글 수집 — 1페이지(현재 HTML) + cpage 2~N 추가 fetch
    let comments = this.parseComments($, sourceId, maxComments);
    const maxCpage = this.parseCpageMax($);
    if (maxCpage > 1 && comments.length < maxComments) {
      const docSrlMatch = url.match(/\/(\d+)/);
      const docSrl = docSrlMatch ? docSrlMatch[1] : null;
      if (docSrl) {
        for (let cp = 2; cp <= maxCpage; cp++) {
          if (comments.length >= maxComments) break;
          try {
            const cpageUrl = `${url}?document_srl=${docSrl}&cpage=${cp}`;
            const cookies = await page
              .context()
              .cookies('https://www.fmkorea.com')
              .catch(() => []);
            const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
            const cpRes = await fetch(cpageUrl, {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml',
                'Accept-Language': 'ko-KR,ko;q=0.9',
                Referer: url,
                ...(cookieHeader ? { Cookie: cookieHeader } : {}),
              },
            });
            if (cpRes.ok) {
              const cpHtml = await cpRes.text();
              const cp$ = cheerio.load(cpHtml);
              const remaining = maxComments - comments.length;
              const pageComments = this.parseComments(cp$, sourceId, remaining);
              comments = comments.concat(pageComments);
            }
          } catch {
            console.warn(`[fmkorea] 댓글 cpage=${cp} fetch 실패: ${url}`);
          }
          await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));
        }
      }
    }

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
      rawData: {
        dateText,
        originalUrl: url,
        contentFallback: content === title || content.length < 20,
      },
      comments,
    };
  }

  /** 본문 HTML에서 댓글 최대 cpage 추출 */
  private parseCpageMax($: cheerio.CheerioAPI): number {
    let max = 1;
    $('a[href*="cpage="]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const m = href.match(/cpage=(\d+)/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    });
    return max;
  }

  /** HTML에서 댓글 파싱 — re 클래스로 대댓글 감지, id 속성으로 부모 추적 */
  private parseComments(
    $: cheerio.CheerioAPI,
    postSourceId: string,
    maxComments: number,
  ): CommunityComment[] {
    const comments: CommunityComment[] = [];
    const $items = $('.fdb_lst_ul > li.fdb_itm');
    if ($items.length === 0) return comments;

    $items.each((_, el) => {
      if (comments.length >= maxComments) return;
      const $li = $(el);

      const content = sanitizeContent($li.find('.xe_content').first().html() ?? '');
      if (!content) return;

      const classAttr = $li.attr('class') ?? '';
      const srlMatch = classAttr.match(/comment-(\d+)/);
      const commentSrl = srlMatch ? srlMatch[1] : `${postSourceId}_c${comments.length}`;

      const isReply = $li.hasClass('re');

      let parentId: string | null = null;
      if (isReply) {
        const idAttr = $li.attr('id') ?? '';
        const parentMatch = idAttr.match(/comment_(\d+)/);
        if (parentMatch) {
          parentId = `fm_comment_${parentMatch[1]}`;
        }
      }

      const author = $li.find('.member_plate, .author').first().text().trim() || '익명';
      const dateText = $li.find('.date, .regdate').first().text().trim();

      comments.push({
        sourceId: `fm_comment_${commentSrl}`,
        parentId,
        content,
        author,
        likeCount: parseInt($li.find('.voted_count').first().text() || '0', 10),
        dislikeCount: 0,
        publishedAt: parseDateText(dateText),
        rawData: { dateText, isReply },
      });
    });

    return comments;
  }

  /** xe_content에서 텍스트 + 미디어 참조 추출 (이미지/영상만 글 대응) */
  private extractContent($: cheerio.CheerioAPI): string {
    let content = '';
    for (const selector of this.selectors.content) {
      const $el = $(selector).first();
      if (!$el.length) continue;

      content = sanitizeContent($el.html() ?? '');
      if (content.length > 20) return content;

      const mediaParts: string[] = [];
      if (content) mediaParts.push(content);

      $el.find('img').each((_, img) => {
        const alt = $(img).attr('alt')?.trim();
        const src = $(img).attr('src') ?? '';
        if (alt && alt.length > 2) {
          mediaParts.push(alt);
        } else if (src) {
          mediaParts.push(`[이미지: ${src}]`);
        }
      });

      $el.find('iframe').each((_, iframe) => {
        const src = $(iframe).attr('src') ?? '';
        if (src) mediaParts.push(`[영상: ${src}]`);
      });

      $el.find('video source, video[src]').each((_, v) => {
        const src = $(v).attr('src') ?? '';
        if (src) mediaParts.push(`[영상: ${src}]`);
      });

      const joined = mediaParts.join(' ').trim();
      if (joined.length > content.length) content = joined;
      if (content.length > 10) break;
    }
    return content;
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
