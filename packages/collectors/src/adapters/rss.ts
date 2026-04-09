import Parser from 'rss-parser';
import { parseSafeUrl, sha1 } from '../utils/url-guard';
import type { Collector, CollectionOptions } from './base';
import type { NaverArticle } from './naver-news';

export interface RssCollectorConfig {
  feedUrl: string;
  maxItems?: number;
}

/**
 * RSS/Atom 피드 범용 수집기.
 * `CollectionOptions.keyword`는 무시하고 피드 전체를 1회 yield한다.
 * 키워드 필터링은 분석 단계에서 수행.
 */
export class RssCollector implements Collector<NaverArticle> {
  readonly source = 'rss';
  private readonly feedUrl: string;
  private readonly maxItems: number;
  private readonly parser: Parser;

  constructor(config: RssCollectorConfig) {
    // 생성자에서 URL을 미리 검증 — 관리자 UI의 test 버튼에서도 이 경로가 호출되므로
    // 잘못된 URL/사설 IP는 저장 전에 차단된다.
    parseSafeUrl(config.feedUrl);
    this.feedUrl = config.feedUrl;
    this.maxItems = config.maxItems ?? 50;
    this.parser = new Parser({
      timeout: 15000,
      headers: {
        'User-Agent': 'AI-SignalCraft/1.0 (+https://ai-signalcraft.local)',
      },
    });
  }

  async *collect(_options: CollectionOptions): AsyncGenerator<NaverArticle[], void, unknown> {
    const feed = await this.parser.parseURL(this.feedUrl);
    const items = (feed.items ?? []).slice(0, this.maxItems);

    const publisher = feed.title ?? this.feedUrl;
    const articles: NaverArticle[] = items.map((item) => {
      const link = item.link ?? item.guid ?? '';
      const rawContent =
        // rss-parser는 content:encoded를 'content:encoded' 또는 'content'로 노출
        // 우선순위: content:encoded > content > contentSnippet > summary
        ((item as Record<string, unknown>)['content:encoded'] as string | undefined) ??
        (item.content as string | undefined) ??
        (item.contentSnippet as string | undefined) ??
        (item.summary as string | undefined) ??
        null;
      const content = rawContent ? stripHtml(String(rawContent)) : null;
      const isoDate = item.isoDate ?? item.pubDate ?? null;
      const publishedAt = isoDate ? new Date(isoDate) : null;
      return {
        sourceId: link ? sha1(link) : sha1(`${this.feedUrl}#${item.title ?? ''}`),
        url: link,
        title: item.title ?? '',
        content,
        author: item.creator ?? item.author ?? null,
        publisher,
        publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
        rawData: item as unknown as Record<string, unknown>,
      };
    });

    if (articles.length > 0) {
      yield articles;
    }
  }
}

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
