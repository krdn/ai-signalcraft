import * as cheerio from 'cheerio';
import { parseSafeUrl, sha1 } from '../utils/url-guard';
import type { Collector, CollectionOptions } from './base';
import type { NaverArticle } from './naver-news';

export interface HtmlSelectors {
  /** 각 목록 항목의 컨테이너 셀렉터 (CSS) */
  item: string;
  /** 제목 셀렉터 (item 컨테이너 내부 상대 경로) */
  title: string;
  /** 링크 셀렉터 — 보통 `a` 또는 `a.title` 등. href를 추출 */
  link: string;
  /** 본문/요약 셀렉터 (선택) */
  body?: string;
  /** 게시일 셀렉터 (선택) */
  date?: string;
}

export interface HtmlCollectorConfig {
  pageUrl: string;
  selectors: HtmlSelectors;
  maxItems?: number;
}

/**
 * 정적 HTML 목록 페이지 범용 수집기.
 * Cheerio + fetch 기반. JS 렌더가 필요한 페이지는 item 0개 반환.
 * Playwright fallback은 v2.
 */
export class HtmlCollector implements Collector<NaverArticle> {
  readonly source = 'html';
  private readonly pageUrl: string;
  private readonly selectors: HtmlSelectors;
  private readonly maxItems: number;
  private readonly baseUrl: URL;

  constructor(config: HtmlCollectorConfig) {
    this.baseUrl = parseSafeUrl(config.pageUrl);
    this.pageUrl = config.pageUrl;
    this.selectors = config.selectors;
    this.maxItems = config.maxItems ?? 50;
  }

  async *collect(_options: CollectionOptions): AsyncGenerator<NaverArticle[], void, unknown> {
    const res = await fetch(this.pageUrl, {
      headers: {
        'User-Agent': 'AI-SignalCraft/1.0 (+https://ai-signalcraft.local)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      throw new Error(`HTML fetch 실패 ${res.status}: ${this.pageUrl}`);
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    const articles: NaverArticle[] = [];

    $(this.selectors.item)
      .slice(0, this.maxItems)
      .each((_, el) => {
        const $el = $(el);
        const title = $el.find(this.selectors.title).first().text().trim();
        const linkEl = $el.find(this.selectors.link).first();
        const href = linkEl.attr('href') ?? linkEl.closest('a').attr('href') ?? '';
        if (!title || !href) return;
        let absoluteUrl: string;
        try {
          absoluteUrl = new URL(href, this.baseUrl).toString();
          // 추출된 링크도 사설 IP 검증
          parseSafeUrl(absoluteUrl);
        } catch {
          return;
        }
        const body = this.selectors.body
          ? $el.find(this.selectors.body).first().text().trim()
          : null;
        const dateStr = this.selectors.date
          ? $el.find(this.selectors.date).first().text().trim()
          : null;
        const parsedDate = dateStr ? new Date(dateStr) : null;
        articles.push({
          sourceId: sha1(absoluteUrl),
          url: absoluteUrl,
          title,
          content: body ?? title ?? null,
          author: null,
          publisher: this.baseUrl.hostname,
          publishedAt: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null,
          rawData: { html: $el.html() ?? '' },
        });
      });

    if (articles.length > 0) {
      yield articles;
    }
  }
}
