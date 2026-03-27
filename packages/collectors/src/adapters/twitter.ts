// X(Twitter) 수집기 -- Nitter 인스턴스 기반 스크래핑
import * as cheerio from 'cheerio';
import type { Collector, CollectionOptions } from './base';
import type { Tweet, TweetReply } from '../types/twitter';

const DEFAULT_NITTER_URL = 'http://localhost:8085';
const MAX_PAGES = 10;
const PAGE_DELAY_MS = 1500;

/**
 * Nitter 기반 X(Twitter) 수집기
 *
 * Nitter는 X의 프라이빗 API를 사용하는 오픈소스 프론트엔드.
 * SSR로 HTML을 렌더링하므로 fetch + Cheerio만으로 파싱 가능.
 * NITTER_BASE_URL 환경변수로 인스턴스 주소 설정.
 */
export class TwitterCollector implements Collector<Tweet> {
  readonly source = 'twitter';

  private get baseUrl(): string {
    return process.env.NITTER_BASE_URL || DEFAULT_NITTER_URL;
  }

  async *collect(options: CollectionOptions): AsyncGenerator<Tweet[], void, unknown> {
    const maxItems = options.maxItems ?? 50;
    const maxReplies = options.maxComments ?? 20;
    let totalCollected = 0;
    let cursor = '';

    for (let page = 0; page < MAX_PAGES; page++) {
      if (totalCollected >= maxItems) break;

      const url = `${this.baseUrl}/search?q=${encodeURIComponent(options.keyword)}&f=tweets${cursor ? `&cursor=${cursor}` : ''}`;

      let html: string;
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          console.warn(`[twitter] Nitter 응답 오류: ${res.status} (${this.baseUrl})`);
          break;
        }
        html = await res.text();
      } catch (err) {
        console.warn(`[twitter] Nitter 연결 실패:`, err instanceof Error ? err.message : err);
        break;
      }

      const $ = cheerio.load(html);
      const tweets = this.parseTweets($, maxReplies);

      if (tweets.length === 0) break;

      // 페이지네이션 커서 추출
      const nextLink = $('.show-more a').last().attr('href');
      const cursorMatch = nextLink?.match(/cursor=([^&]+)/);
      cursor = cursorMatch?.[1] ?? '';

      const batch = tweets.slice(0, maxItems - totalCollected);
      totalCollected += batch.length;
      yield batch;

      if (!cursor) break;
      await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
    }
  }

  private parseTweets($: cheerio.CheerioAPI, maxReplies: number): Tweet[] {
    const tweets: Tweet[] = [];

    $('.timeline-item').each((_, el) => {
      const $item = $(el);

      // 핀 트윗 등 비표준 항목 건너뛰기
      if ($item.hasClass('show-more')) return;

      const content = $item.find('.tweet-content').text().trim();
      if (!content) return;

      const fullname = $item.find('.fullname').first().text().trim();
      const handle = $item.find('.username').first().text().trim().replace('@', '');
      const tweetLink = $item.find('.tweet-link').attr('href') ?? '';
      const tweetId = tweetLink.split('/').pop()?.replace('#m', '') ?? '';

      // 날짜 파싱
      const dateStr = $item.find('.tweet-date a').attr('title') ?? '';
      const publishedAt = dateStr ? new Date(dateStr) : null;

      // 통계
      const stats = $item.find('.tweet-stat');
      const replyCount = this.parseStatCount(stats.eq(0).find('.tweet-stat-count').text());
      const retweetCount = this.parseStatCount(stats.eq(1).find('.tweet-stat-count').text());
      const likeCount = this.parseStatCount(stats.eq(2).find('.tweet-stat-count').text());

      tweets.push({
        sourceId: `tw_${tweetId}`,
        url: `https://x.com${tweetLink.replace('#m', '')}`,
        content,
        author: fullname || handle,
        authorHandle: handle,
        publishedAt: publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : null,
        likeCount,
        retweetCount,
        replyCount,
        rawData: { nitterUrl: `${this.baseUrl}${tweetLink}`, dateStr },
        replies: [], // 리플은 개별 트윗 페이지에서 수집해야 하므로 빈 배열
      });
    });

    return tweets;
  }

  private parseStatCount(text: string): number {
    const cleaned = text.trim().replace(/,/g, '');
    if (cleaned.endsWith('K')) return Math.round(parseFloat(cleaned) * 1000);
    if (cleaned.endsWith('M')) return Math.round(parseFloat(cleaned) * 1000000);
    return parseInt(cleaned, 10) || 0;
  }
}
