// 커뮤니티(clien/dcinside/fmkorea) 공통 수집 로직 -- 페이지 순회 + 게시글 수집 루프
import type { Page } from 'playwright';
import type { CommunityPost } from '../types/community';
import { sleep } from '../utils/browser';
import type { CollectionOptions } from './base';
import { BrowserCollector } from './browser-collector';

export interface SiteSelectors {
  list: string[];
  content: string[];
  comment: string[];
}

export abstract class CommunityBaseCollector extends BrowserCollector<CommunityPost> {
  protected abstract readonly selectors: SiteSelectors;
  protected abstract readonly baseUrl: string;

  protected abstract buildSearchUrl(keyword: string, page: number): string;
  protected abstract parseSearchResults(html: string): { url: string; title: string }[];
  protected abstract fetchPost(
    page: Page,
    url: string,
    title: string,
    maxComments: number,
  ): Promise<CommunityPost | null>;

  // 차단 감지 -- 기본 false, clien/fmkorea에서 override
  protected detectBlocked(_html: string): boolean {
    return false;
  }

  /**
   * 보안 챌린지 페이지 감지 및 통과 (에펨코리아 WASM 안티봇 등)
   * 보안 페이지가 감지되면 JS 실행 완료 + 리다이렉트를 기다림
   * 기본: 감지 안 함 (subclass에서 override)
   */
  protected async handleSecurityChallenge(_page: Page): Promise<boolean> {
    return false; // 기본: 보안 챌린지 없음
  }

  protected async *doCollect(
    page: Page,
    options: CollectionOptions,
  ): AsyncGenerator<CommunityPost[], void, unknown> {
    const maxItems = options.maxItems ?? this.config.defaultMaxItems;
    const maxComments = options.maxComments ?? 100;
    let totalCollected = 0;

    for (let pageNum = 1; pageNum <= this.config.maxSearchPages; pageNum++) {
      if (totalCollected >= maxItems) break;

      const searchUrl = this.buildSearchUrl(options.keyword, pageNum);
      try {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch (navErr) {
        console.warn(`${this.source} 검색 페이지 로드 실패 (page ${pageNum}):`, navErr);
        break;
      }

      // 보안 챌린지 처리 (에펨코리아 WASM 안티봇 등)
      const challengeHandled = await this.handleSecurityChallenge(page);
      if (challengeHandled) {
        // 챌린지 통과 후 원래 검색 페이지를 다시 로드 (networkidle로 완전 로드 대기)
        try {
          await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });
          await page.waitForTimeout(2000);
        } catch (navErr) {
          console.warn(
            `${this.source} 챌린지 후 검색 페이지 재로드 실패 (page ${pageNum}):`,
            navErr,
          );
          break;
        }
      }

      await page.waitForTimeout(this.config.pageDelay.min + Math.random() * 1000);

      const html = await page.content();
      const postLinks = this.parseSearchResults(html);

      if (postLinks.length === 0) {
        if (this.detectBlocked(html)) {
          console.warn(`${this.source} 검색 차단 감지 -- 수집 중단`);
        }
        break;
      }

      const posts: CommunityPost[] = [];
      for (const link of postLinks) {
        if (totalCollected >= maxItems) break;
        try {
          const post = await this.fetchPost(page, link.url, link.title, maxComments);
          if (post) {
            posts.push(post);
            totalCollected++;
          }
        } catch (err) {
          console.warn(`${this.source} 게시글 수집 실패 (${link.url}):`, err);
        }
        await sleep(this.config.postDelay.min, this.config.postDelay.max);
      }

      if (posts.length > 0) {
        yield posts;
      }

      await sleep(this.config.pageDelay.min, this.config.pageDelay.max);
    }
  }
}
