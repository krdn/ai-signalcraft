// DC갤러리 수집기 -- CommunityBaseCollector 상속
// v3: 댓글 API 직접 호출 + Playwright 의존 최소화 + 갤러리 종류 자동 감지
import * as cheerio from 'cheerio';
import type { CommunityPost, CommunityComment } from '../types/community';
import {
  parseDateText,
  parseDateTextOrNull,
  sanitizeContent,
  buildSearchUrl,
} from '../utils/community-parser';
import { getRandomUserAgent, sleep } from '../utils/browser';
import { CommunityBaseCollector, type SiteSelectors } from './community-base-collector';
import type { BrowserCollectorConfig } from './browser-collector';

type GallType = 'G' | 'M' | 'MI';

const COMMENT_API_URL = 'https://gall.dcinside.com/board/comment/';

export class DCInsideCollector extends CommunityBaseCollector {
  readonly source = 'dcinside';
  protected readonly baseUrl = 'https://gall.dcinside.com';

  protected readonly config: BrowserCollectorConfig = {
    pageDelay: { min: 3000, max: 5000 },
    postDelay: { min: 400, max: 800 },
    defaultMaxItems: 50,
    maxSearchPages: 120,
  };

  protected readonly selectors: SiteSelectors = {
    list: ['.sch_result_list a.tit_txt', '.sch_result_list li > a'],
    content: ['.write_div', '.writing_view_box', '#container .write_div'],
    comment: [], // 미사용 — 댓글은 API로 수집
  };

  protected override sortedByDateDescending(): boolean {
    return true;
  }

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
    return buildSearchUrl('dcinside', keyword, page);
  }

  protected parseSearchResults(
    html: string,
  ): { url: string; title: string; publishedAt?: Date | null }[] {
    const $ = cheerio.load(html);
    const results: { url: string; title: string; publishedAt?: Date | null }[] = [];

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

  protected async fetchPost(
    _page: import('playwright').Page,
    url: string,
    title: string,
    maxComments: number,
  ): Promise<CommunityPost | null> {
    const html = await this.fetchPostHtml(url);
    if (!html) return null;

    const $ = cheerio.load(html);

    let content = '';
    for (const selector of this.selectors.content) {
      content = sanitizeContent($(selector).html() ?? '');
      if (content.length > 10) break;
    }

    const author = $('.gall_writer .nickname, .gall_writer .ip').first().text().trim() || '익명';
    const dateText = $('.gall_date').attr('title')?.trim() || $('.gall_date').text().trim();
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

    const boardName =
      $('h3.title, .gallview_head .title').text().trim() || this.extractBoardFromUrl(url);

    const { galleryId, gallType } = this.parseGalleryInfo(url);
    const postNo = this.extractPostNo(url);

    const { comments, totalCount } =
      maxComments > 0
        ? await this.fetchCommentsViaApi(galleryId, postNo, gallType, maxComments)
        : { comments: [], totalCount: 0 };

    return {
      sourceId: `dc_${postNo}`,
      url,
      title,
      content: content || title,
      author,
      boardName,
      publishedAt,
      viewCount,
      commentCount: totalCount,
      likeCount,
      rawData: { dateText, gallType, originalUrl: url },
      comments,
    };
  }

  private async fetchPostHtml(url: string): Promise<string | null> {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'ko-KR,ko;q=0.9',
          Referer: 'https://gall.dcinside.com/',
        },
      });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }

  private async fetchCommentsViaApi(
    galleryId: string,
    postNo: string,
    gallType: GallType,
    maxComments: number,
  ): Promise<{ comments: CommunityComment[]; totalCount: number }> {
    const comments: CommunityComment[] = [];
    let totalCount = 0;

    for (let commentPage = 1; ; commentPage++) {
      if (comments.length >= maxComments) break;

      const body = new URLSearchParams({
        id: galleryId,
        no: postNo,
        cmt_id: galleryId,
        cmt_no: postNo,
        e_s_n_o: 'comment_api',
        comment_page: String(commentPage),
        sort: 'D',
        _GALLTYPE_: gallType,
      });

      let json: Record<string, unknown>;
      try {
        const res = await fetch(COMMENT_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': getRandomUserAgent(),
            Referer: `https://gall.dcinside.com/board/view/?id=${galleryId}&no=${postNo}`,
          },
          body: body.toString(),
        });
        if (!res.ok) break;
        json = (await res.json()) as Record<string, unknown>;
      } catch {
        break;
      }

      totalCount = parseInt(String(json.total_cnt ?? '0'), 10);
      const items = json.comments;
      if (!Array.isArray(items) || items.length === 0) break;

      for (const item of items) {
        if (comments.length >= maxComments) break;
        const memo = sanitizeContent(String(item.memo ?? ''));
        if (!memo) continue;

        const depth = Number(item.depth ?? 0);
        const parentNo = item.c_no ? String(item.c_no) : null;

        comments.push({
          sourceId: `dc_comment_${item.no}`,
          parentId: depth > 0 && parentNo ? `dc_comment_${parentNo}` : null,
          content: memo,
          author: String(item.name || '익명'),
          likeCount: 0,
          dislikeCount: 0,
          publishedAt: parseDateText(String(item.reg_date ?? '')),
          rawData: {
            no: item.no,
            depth,
            c_no: item.c_no ?? null,
            nicktype: item.nicktype ?? null,
            user_id: item.user_id ?? null,
          },
        });
      }

      const pagination = String(json.pagination ?? '');
      if (!pagination.includes('comment_page')) break;

      await sleep(200, 400);
    }

    return { comments, totalCount };
  }

  private parseGalleryInfo(url: string): { galleryId: string; gallType: GallType } {
    const idMatch = url.match(/id=([^&]+)/);
    const galleryId = idMatch ? idMatch[1] : 'unknown';
    if (url.includes('/mini/')) return { galleryId, gallType: 'MI' };
    if (url.includes('/mgallery/')) return { galleryId, gallType: 'M' };
    return { galleryId, gallType: 'G' };
  }

  private extractPostNo(url: string): string {
    const match = url.match(/no=(\d+)/);
    return match ? match[1] : String(Date.now());
  }

  private extractBoardFromUrl(url: string): string {
    const match = url.match(/id=([^&]+)/);
    return match ? match[1] : 'unknown';
  }
}
