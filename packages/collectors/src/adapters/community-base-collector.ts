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

  /**
   * 검색 URL 생성. dateRange가 지원되는 사이트는 일자별로 쿼리를 분할할 수 있다.
   * 지원 여부는 supportsDateRangeSearch()로 표시.
   */
  protected abstract buildSearchUrl(
    keyword: string,
    page: number,
    dateRange?: { start: string; end: string },
  ): string;
  /**
   * 검색 결과 HTML에서 게시글 정보 파싱.
   * publishedAt을 추출할 수 있으면 사전 필터링으로 불필요한 본문 요청을 줄인다 (에펨 등).
   */
  protected abstract parseSearchResults(
    html: string,
  ): { url: string; title: string; publishedAt?: Date | null }[];
  protected abstract fetchPost(
    page: Page,
    url: string,
    title: string,
    maxComments: number,
  ): Promise<CommunityPost | null>;

  /**
   * 사이트의 검색 URL이 날짜 범위 파라미터를 지원하는지 표시.
   * true면 일자별 분할 쿼리로 각 날짜에 균등하게 한도를 분배한다 (네이버 방식).
   * 기본 false (DC/Clien은 날짜 파라미터 미지원).
   */
  protected supportsDateRangeSearch(): boolean {
    return false;
  }

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

    // TTL 재사용: 완전 스킵 URL 집합과 댓글-only URL 집합 (Set 으로 O(1) 조회)
    const skipUrlSet = new Set(options.reusePlan?.skipUrls ?? []);
    const refetchCommentsOnlySet = new Set(options.reusePlan?.refetchCommentsFor ?? []);

    // 기간 필터: publishedAt이 [startDate, endDate) 범위 밖이면 제외.
    const startTs = new Date(options.startDate).getTime();
    const endTs = new Date(options.endDate).getTime();
    const isInDateRange = (d: Date | null | undefined): boolean => {
      if (!d) return true; // publishedAt 파싱 실패분은 보수적으로 유지
      const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
      if (Number.isNaN(t)) return true;
      return t >= startTs && t < endTs;
    };

    // 사이트가 날짜 필터를 지원하는 경우: 네이버와 동일하게 일자별 분할 수집.
    // 한도는 "일당 건수" 의미이므로 maxItems를 날짜 수로 균등 분배해야 각 날짜가 묻히지 않음.
    if (this.supportsDateRangeSearch()) {
      yield* this.collectByDayRange(page, options, {
        maxItems,
        maxComments,
        skipUrlSet,
        refetchCommentsOnlySet,
        isInDateRange,
      });
      return;
    }

    // 사이트가 날짜 필터를 지원하지 않는 경우(DC/Clien): 사후 필터 + 조기 종료 방식 유지
    yield* this.collectLegacySequential(page, options, {
      maxItems,
      maxComments,
      skipUrlSet,
      refetchCommentsOnlySet,
      isInDateRange,
      startTs,
    });
  }

  private async *collectByDayRange(
    page: Page,
    options: CollectionOptions,
    ctx: {
      maxItems: number;
      maxComments: number;
      skipUrlSet: Set<string>;
      refetchCommentsOnlySet: Set<string>;
      isInDateRange: (d: Date | null | undefined) => boolean;
    },
  ): AsyncGenerator<CommunityPost[], void, unknown> {
    const days = splitIntoDays(options.startDate, options.endDate);
    const perDayLimit = Math.max(1, Math.ceil(ctx.maxItems / days.length));
    const globalSeen = new Set<string>();
    let totalCollected = 0;
    let skippedCount = 0;
    let outOfRangeCount = 0;

    // 각 날짜별로 perDayLimit까지 수집
    for (const day of days) {
      if (totalCollected >= ctx.maxItems) break;

      const dateRange = { start: day.toISOString(), end: day.toISOString() };
      let collectedThisDay = 0;

      for (
        let pageNum = 1;
        pageNum <= this.config.maxSearchPages && collectedThisDay < perDayLimit;
        pageNum++
      ) {
        if (totalCollected >= ctx.maxItems) break;

        const searchUrl = this.buildSearchUrl(options.keyword, pageNum, dateRange);
        const postLinks = await this.loadSearchPage(page, searchUrl, pageNum);
        if (!postLinks || postLinks.length === 0) break;

        const posts: CommunityPost[] = [];
        for (const link of postLinks) {
          if (collectedThisDay >= perDayLimit || totalCollected >= ctx.maxItems) break;
          if (globalSeen.has(link.url)) continue;
          globalSeen.add(link.url);
          if (ctx.skipUrlSet.has(link.url)) {
            skippedCount++;
            continue;
          }

          try {
            const _commentsOnly = ctx.refetchCommentsOnlySet.has(link.url);
            const post = await this.fetchPost(page, link.url, link.title, ctx.maxComments);
            if (post) {
              if (!ctx.isInDateRange(post.publishedAt)) {
                outOfRangeCount++;
                continue;
              }
              posts.push(post);
              collectedThisDay++;
              totalCollected++;
            }
          } catch (err) {
            console.warn(`${this.source} 게시글 수집 실패 (${link.url}):`, err);
          }
          await sleep(this.config.postDelay.min, this.config.postDelay.max);
        }

        if (posts.length > 0) yield posts;
        await sleep(this.config.pageDelay.min, this.config.pageDelay.max);
      }
    }

    this.logCollectionEnd(skippedCount, outOfRangeCount);
  }

  private async *collectLegacySequential(
    page: Page,
    options: CollectionOptions,
    ctx: {
      maxItems: number;
      maxComments: number;
      skipUrlSet: Set<string>;
      refetchCommentsOnlySet: Set<string>;
      isInDateRange: (d: Date | null | undefined) => boolean;
      startTs: number;
    },
  ): AsyncGenerator<CommunityPost[], void, unknown> {
    let totalCollected = 0;
    let skippedCount = 0;
    let outOfRangeCount = 0;
    let preFilterSkipCount = 0; // 검색 결과 단계에서 사전 필터된 수

    for (let pageNum = 1; pageNum <= this.config.maxSearchPages; pageNum++) {
      if (totalCollected >= ctx.maxItems) break;

      const searchUrl = this.buildSearchUrl(options.keyword, pageNum);
      const postLinks = await this.loadSearchPage(page, searchUrl, pageNum);
      if (!postLinks || postLinks.length === 0) break;

      const posts: CommunityPost[] = [];
      // 한 페이지 내에서 연속된 "기간 이전" 게시물 개수 -- 임계치 초과 시 검색 중단
      let consecutiveOldCount = 0;
      const CONSECUTIVE_OLD_THRESHOLD = 10;

      for (const link of postLinks) {
        if (totalCollected >= ctx.maxItems) break;
        if (ctx.skipUrlSet.has(link.url)) {
          skippedCount++;
          continue;
        }

        // 사전 필터: 검색 결과 HTML에 이미 publishedAt이 포함돼 있으면 본문 요청 없이 판단
        // (에펨 검색결과의 <span class="time">YYYY-MM-DD HH:MM</span> 등)
        if (link.publishedAt) {
          if (!ctx.isInDateRange(link.publishedAt)) {
            preFilterSkipCount++;
            const linkTs = link.publishedAt.getTime();
            if (!Number.isNaN(linkTs) && linkTs < ctx.startTs) {
              consecutiveOldCount++;
              if (consecutiveOldCount >= CONSECUTIVE_OLD_THRESHOLD) break;
            }
            continue;
          }
          consecutiveOldCount = 0;
        }

        try {
          const _commentsOnly = ctx.refetchCommentsOnlySet.has(link.url);
          const post = await this.fetchPost(page, link.url, link.title, ctx.maxComments);
          if (post) {
            if (!ctx.isInDateRange(post.publishedAt)) {
              outOfRangeCount++;
              const postTs = post.publishedAt instanceof Date ? post.publishedAt.getTime() : NaN;
              if (!Number.isNaN(postTs) && postTs < ctx.startTs) {
                consecutiveOldCount++;
              }
              continue;
            }
            consecutiveOldCount = 0;
            posts.push(post);
            totalCollected++;
          }
        } catch (err) {
          console.warn(`${this.source} 게시글 수집 실패 (${link.url}):`, err);
        }
        await sleep(this.config.postDelay.min, this.config.postDelay.max);
      }

      if (consecutiveOldCount >= CONSECUTIVE_OLD_THRESHOLD) {
        console.info(
          `${this.source} 기간 이전 게시물 ${consecutiveOldCount}건 연속 발견 -- 검색 중단`,
        );
        if (posts.length > 0) yield posts;
        break;
      }

      if (posts.length > 0) yield posts;
      await sleep(this.config.pageDelay.min, this.config.pageDelay.max);
    }

    this.logCollectionEnd(skippedCount, outOfRangeCount, preFilterSkipCount);
  }

  /**
   * 검색 페이지 로드 (보안 챌린지 처리 + 지수 백오프 재시도).
   * 결과가 비었거나 실패면 null.
   *
   * 안티봇 차단(에펨 HTTP 430, 짧은 응답) 시 딜레이를 늘려가며 최대 3회 재시도.
   * 사이트별 handleSecurityChallenge()로 쿠키 기반 챌린지를 통과한 뒤 같은 URL 재시도.
   */
  private async loadSearchPage(
    page: Page,
    searchUrl: string,
    pageNum: number,
  ): Promise<{ url: string; title: string; publishedAt?: Date | null }[] | null> {
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch (navErr) {
        console.warn(
          `${this.source} 검색 페이지 로드 실패 (page ${pageNum}, attempt ${attempt}):`,
          navErr,
        );
        if (attempt < MAX_ATTEMPTS) {
          await sleep(2000 * attempt, 3000 * attempt);
          continue;
        }
        return null;
      }

      const challengeHandled = await this.handleSecurityChallenge(page);
      if (challengeHandled) {
        try {
          await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });
          await page.waitForTimeout(2000);
        } catch (navErr) {
          console.warn(
            `${this.source} 챌린지 후 재로드 실패 (page ${pageNum}, attempt ${attempt}):`,
            navErr,
          );
          if (attempt < MAX_ATTEMPTS) {
            await sleep(3000 * attempt, 5000 * attempt);
            continue;
          }
          return null;
        }
      }

      await page.waitForTimeout(this.config.pageDelay.min + Math.random() * 1000);

      const html = await page.content();
      const postLinks = this.parseSearchResults(html);

      // 차단으로 판정되는 경우: 백오프 후 재시도
      if (postLinks.length === 0 && this.detectBlocked(html)) {
        console.warn(
          `${this.source} 검색 차단 감지 (page ${pageNum}, attempt ${attempt}) -- 백오프 후 재시도`,
        );
        if (attempt < MAX_ATTEMPTS) {
          await sleep(5000 * attempt, 8000 * attempt);
          continue;
        }
        return null;
      }

      return postLinks;
    }
    return null;
  }

  private logCollectionEnd(
    skippedCount: number,
    outOfRangeCount: number,
    preFilterSkipCount = 0,
  ): void {
    if (skippedCount > 0) {
      console.info(`${this.source} TTL 재사용으로 ${skippedCount}건 스킵`);
    }
    if (outOfRangeCount > 0) {
      console.info(`${this.source} 기간 외(published_at)로 ${outOfRangeCount}건 제외`);
    }
    if (preFilterSkipCount > 0) {
      console.info(`${this.source} 검색 결과 사전 필터로 ${preFilterSkipCount}건 본문 요청 생략`);
    }
  }
}

/**
 * 네이버 수집기와 동일 규칙(로컬 TZ, inclusive, 최소 1일)으로 Date 배열 생성
 */
function splitIntoDays(startISO: string, endISO: string): Date[] {
  const start = new Date(startISO);
  const end = new Date(endISO);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  if (days.length === 0) days.push(new Date(start));
  return days;
}
