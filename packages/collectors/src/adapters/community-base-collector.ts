// 커뮤니티(clien/dcinside/fmkorea) 공통 수집 로직 -- 페이지 순회 + 게시글 수집 루프
import type { Page } from 'playwright';
import type { CommunityPost } from '../types/community';
import { sleep } from '../utils/browser';
import { splitIntoDaysKst, kstDayStartMs } from '../utils/community-parser';
import type { CollectionOptions, CollectionStats } from './base';
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

  /**
   * 사이트 검색이 "최신순 정렬은 되지만 날짜 범위 파라미터는 없는" 경우 표시.
   * (DC인사이드, Clien) — true면 클라이언트측 일자 윈도우로 perDay 균등 분배.
   * supportsDateRangeSearch()가 true인 사이트가 우선이며, 둘 다 false면 legacy 경로.
   */
  protected sortedByDateDescending(): boolean {
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

    // 기간 필터: KST 자정 기준 [startDay, endDay + 24h)로 확장.
    // 사용자가 "KST 04-11 ~ KST 04-18"을 입력하면 04-11 00:00 KST ~ 04-19 00:00 KST 가 기간.
    // 컨테이너 TZ가 UTC라도 사용자 인식과 정확히 일치한다.
    const startTs = kstDayStartMs(new Date(options.startDate));
    const endTs = kstDayStartMs(new Date(options.endDate)) + 86400000;
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

    if (this.sortedByDateDescending()) {
      yield* this.collectByDayWindowDescending(page, options, {
        maxItems,
        maxComments,
        skipUrlSet,
        refetchCommentsOnlySet,
        isInDateRange,
        startTs,
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
    // KST 자정 기준 일자 분할 + perDayLimit은 options.maxItemsPerDay 우선.
    // ⚠️ 한도 초과 금지, 부족분 보충 금지.
    const days = splitIntoDaysKst(options.startDate, options.endDate);
    const perDayLimit =
      options.maxItemsPerDay ?? Math.max(1, Math.floor(ctx.maxItems / days.length));
    const globalSeen = new Set<string>();
    const enforced = new Map<number, number>(); // yield 직전 cap 검증용
    const dayKey = (d: Date): number => kstDayStartMs(d);
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

        const filtered = this.enforcePerDayCap(posts, dayKey, perDayLimit, enforced);
        if (filtered.length > 0) yield filtered;
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
    let perDayCapSkipCount = 0; // 일자별 한도 초과로 본문 요청을 생략한 수
    let pageEmptyCount = 0; // 빈/차단 페이지 누적 수 (stats용)
    let endReason: CollectionStats['endReason'] = 'completed';
    let lastPageReached = 0;

    // per-day cap: 사이트 검색이 시간순으로 정렬되어 있고 publishedAt이 사전 추출되면
    // 단일 검색 순회만으로도 일자별 균등 분배가 가능. publishedAt이 없는 사이트(현재 dcinside/clien)는
    // 분기 자체가 비활성화되어 기존 동작 그대로 유지됨.
    //
    // perDayLimit 결정 우선순위:
    //   1) options.maxItemsPerDay (flows.ts가 perDay 모드일 때 사용자 원본 한도를 명시 전달)
    //   2) 미지정 시 cap 비활성화 (Number.MAX_SAFE_INTEGER) — total 모드 등 일자별 분배가 의미 없는 경우
    // ⚠️ 한도 초과 금지: 절대 perDayLimit을 넘기지 않는다.
    // ⚠️ 부족분 보충 금지: 한 일자가 모자라도 다른 일자에서 채우지 않는다.
    // ⚠️ KST 자정 기준: 컨테이너 TZ가 UTC라도 사용자 입력 일자와 정확히 일치하도록 KST로 normalize.
    // (days 분할 자체는 이 경로에서 직접 필요 없고 dayKey로 KST 자정 ms만 계산)
    const perDayLimit = options.maxItemsPerDay ?? Number.MAX_SAFE_INTEGER;
    const dayCount = new Map<number, number>(); // 위쪽 사전/사후 cap 검사용 (효율 최적화)
    const enforced = new Map<number, number>(); // yield 직전 최종 cap 검증용 (절대 보장)
    // KST 자정 ms를 dayKey로 사용 → 컨테이너 TZ 무관, 사용자 인식과 일치
    const dayKey = (d: Date): number => kstDayStartMs(d);

    // 옵션 3 (v2): 빈/차단 페이지를 만나도 즉시 break하지 않고 다음 페이지 시도.
    // 일시 차단(rate limit)에서 회복 가능. 연속 N번 빈 페이지면 진짜 끝으로 판단하고 종료.
    // v2: 3 → 5로 상향, clien이 간헐적으로 차단했다가 풀어주는 패턴 관찰 (Job #223).
    const MAX_CONSECUTIVE_EMPTY_PAGES = 5;
    let consecutiveEmptyPages = 0;

    for (let pageNum = 1; pageNum <= this.config.maxSearchPages; pageNum++) {
      lastPageReached = pageNum;
      if (totalCollected >= ctx.maxItems) {
        endReason = 'maxItemsReached';
        break;
      }

      const searchUrl = this.buildSearchUrl(options.keyword, pageNum);
      const postLinks = await this.loadSearchPage(page, searchUrl, pageNum);
      if (!postLinks || postLinks.length === 0) {
        consecutiveEmptyPages++;
        pageEmptyCount++;
        if (consecutiveEmptyPages >= MAX_CONSECUTIVE_EMPTY_PAGES) {
          // 진짜 검색 결과 끝 또는 영구 차단 → 종료
          endReason =
            pageEmptyCount >= MAX_CONSECUTIVE_EMPTY_PAGES ? 'pageEmptyOrBlocked' : 'noMoreResults';
          console.warn(
            `${this.source} 빈/차단 페이지 ${consecutiveEmptyPages}회 연속 — 페이지 ${pageNum}에서 종료`,
          );
          break;
        }
        // 빈 페이지에 대한 지수 백오프 후 다음 페이지 시도 (10s → 20s → 40s → 80s → 160s).
        // clien은 rate-limit 해제까지 수십 초~수 분 필요하다는 관찰 기반.
        const backoffBase = 10000 * Math.pow(2, consecutiveEmptyPages - 1);
        console.info(
          `${this.source} 페이지 ${pageNum} 빈/차단 — ${Math.round(backoffBase / 1000)}s 백오프 후 다음 페이지 시도 (${consecutiveEmptyPages}/${MAX_CONSECUTIVE_EMPTY_PAGES})`,
        );
        await sleep(backoffBase, backoffBase + 3000);
        continue;
      }
      consecutiveEmptyPages = 0; // 정상 응답 → 카운터 리셋

      const posts: CommunityPost[] = [];
      // 한 페이지 내에서 연속된 "확실히 옛날인" 게시물 개수 -- 임계치 초과 시 검색 중단.
      // ⚠️ 임계값을 30으로 상향 (이전 10) — fmkorea 검색 상위에 섞이는 광고/BEST 글
      //    (사용자 기간보다 훨씬 오래된 글)이 10건 연속 등장하면 false positive로 검색이 일찍 끊김.
      // ⚠️ "확실히 옛날" 판정 기준: startTs보다 30일 이상 더 옛날인 글만 카운트.
      //    (예: 사용자가 04-11~04-18 입력 → 03-12 이전 글만 "옛날"로 카운트, 04-09 글은 안 카운트)
      let consecutiveOldCount = 0;
      const CONSECUTIVE_OLD_THRESHOLD = 30;
      const OLD_MARGIN_MS = 30 * 86400000;

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
            // "확실히 옛날" 글만 consecutiveOldCount에 카운트 — 광고/추천글 false positive 방지
            if (!Number.isNaN(linkTs) && linkTs < ctx.startTs - OLD_MARGIN_MS) {
              consecutiveOldCount++;
              if (consecutiveOldCount >= CONSECUTIVE_OLD_THRESHOLD) break;
            }
            continue;
          }
          consecutiveOldCount = 0;

          // 사전 cap: link.publishedAt 기준 한도 초과면 본문 fetch 자체를 스킵 (성능 최적화).
          // ⚠️ dayCount는 본문 fetch 성공 시점에만 누적 — 사전에 +1 하면 fetch 실패가
          // cap 슬롯을 잠식해 일자별 0건이 되는 버그가 발생.
          const k = dayKey(link.publishedAt);
          if ((dayCount.get(k) ?? 0) >= perDayLimit) {
            perDayCapSkipCount++;
            continue;
          }
        }

        try {
          const _commentsOnly = ctx.refetchCommentsOnlySet.has(link.url);
          const post = await this.fetchPost(page, link.url, link.title, ctx.maxComments);
          if (post) {
            if (!ctx.isInDateRange(post.publishedAt)) {
              outOfRangeCount++;
              const postTs = post.publishedAt instanceof Date ? post.publishedAt.getTime() : NaN;
              // 동일 정책: "확실히 옛날" 글만 카운트
              if (!Number.isNaN(postTs) && postTs < ctx.startTs - OLD_MARGIN_MS) {
                consecutiveOldCount++;
              }
              continue;
            }
            consecutiveOldCount = 0;

            // 본문 fetch 성공 시점에만 dayCount 누적 (post.publishedAt 기준 = 정확한 일자).
            // fetch 실패는 catch로 빠져 dayCount 영향 X → 일자별 슬롯이 잠식 안 됨.
            if (post.publishedAt) {
              const pk = dayKey(post.publishedAt as Date);
              const pc = dayCount.get(pk) ?? 0;
              if (pc >= perDayLimit) {
                perDayCapSkipCount++;
                continue;
              }
              dayCount.set(pk, pc + 1);
            }

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
        const filteredFinal = this.enforcePerDayCap(posts, dayKey, perDayLimit, enforced);
        if (filteredFinal.length > 0) yield filteredFinal;
        endReason = 'consecutiveOldThreshold';
        break;
      }

      // ⚠️ 이중 안전망: posts 누적 후에도 한 번 더 일자별 cap을 강제.
      // 위쪽 cap 검사가 어떤 이유로 누락되더라도 yield 단계에서 절대 perDayLimit 초과 X.
      const filtered = this.enforcePerDayCap(posts, dayKey, perDayLimit, enforced);
      if (filtered.length > 0) yield filtered;
      await sleep(this.config.pageDelay.min, this.config.pageDelay.max);

      // 페이지 루프 자연 종료 시 maxSearchPages 도달 → endReason 설정
      if (pageNum === this.config.maxSearchPages) {
        endReason = 'pageLimitReached';
      }
    }

    if (perDayCapSkipCount > 0 && options.maxItemsPerDay) {
      console.info(
        `${this.source} per-day cap(${options.maxItemsPerDay}/일)으로 ${perDayCapSkipCount}건 본문 요청 생략`,
      );
    }
    this.logCollectionEnd(skippedCount, outOfRangeCount, preFilterSkipCount);

    // ⚠️ 옵션 1: 종료 통계를 lastRunStats에 저장 → collector-worker가 DB events에 기록
    const dist: Record<string, number> = {};
    for (const [k, v] of dayCount.entries()) {
      // KST yyyy-mm-dd로 변환 (k는 KST 자정 ms = UTC -9h)
      const kstStr = new Date(k + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
      dist[kstStr] = v;
    }
    this.lastRunStats = {
      endReason,
      lastPage: lastPageReached,
      perDayCount: dist,
      perDayCapSkip: perDayCapSkipCount,
      preFilterSkip: preFilterSkipCount,
      outOfRange: outOfRangeCount,
      pageEmptyCount,
    };
    console.info(
      `${this.source} 종료: total=${totalCollected} lastPage=${lastPageReached} reason=${endReason} dayCount(KST)=${JSON.stringify(dist)} perDayCapSkip=${perDayCapSkipCount} preFilterSkip=${preFilterSkipCount} outOfRange=${outOfRangeCount} pageEmpty=${pageEmptyCount}`,
    );
  }

  /**
   * yield 직전 일자별 cap 강제 — 이중 안전망(독립 카운터로 검증).
   *
   * 위쪽 dayCount 로직과 무관하게 enforced(영구 누적) Map으로 일자별 송출량을 추적.
   * yield 시점에 perDayLimit을 넘는 글은 잘라낸다. 위쪽 cap이 어떤 이유로 누락되더라도
   * 이 함수가 최후 보루로 절대 한도 초과를 허용하지 않는다.
   *
   * dropped > 0이면 위쪽 cap 로직에 결함이 있다는 신호 → 경고 로그.
   */
  private enforcePerDayCap(
    posts: CommunityPost[],
    dayKey: (d: Date) => number,
    perDayLimit: number,
    enforced: Map<number, number>,
  ): CommunityPost[] {
    if (perDayLimit === Number.MAX_SAFE_INTEGER) return posts;
    const out: CommunityPost[] = [];
    let dropped = 0;
    for (const p of posts) {
      if (!p.publishedAt) {
        out.push(p);
        continue;
      }
      const k = dayKey(p.publishedAt as Date);
      const cur = enforced.get(k) ?? 0;
      if (cur >= perDayLimit) {
        dropped++;
        continue;
      }
      enforced.set(k, cur + 1);
      out.push(p);
    }
    if (dropped > 0) {
      console.warn(
        `${this.source} ⚠️ enforcePerDayCap: yield 단계에서 ${dropped}건 추가 제거 (한도 ${perDayLimit}/일) — 위쪽 cap 누락 가능성`,
      );
    }
    return out;
  }

  /**
   * 검색 페이지 로드 (보안 챌린지 처리 + 지수 백오프 재시도).
   * 결과가 비었거나 실패면 null.
   *
   * 안티봇 차단(에펨 HTTP 430, 짧은 응답) 시 딜레이를 늘려가며 최대 3회 재시도.
   * 사이트별 handleSecurityChallenge()로 쿠키 기반 챌린지를 통과한 뒤 같은 URL 재시도.
   */
  /**
   * 기본 구현은 Playwright page.goto를 사용. 사이트별 override 가능 (예: clien의 fetch 기반 override).
   */
  protected async loadSearchPage(
    page: Page,
    searchUrl: string,
    pageNum: number,
  ): Promise<{ url: string; title: string; publishedAt?: Date | null }[] | null> {
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        // ⚠️ 옵션 2: Referer + Accept-Language 헤더로 자연스러운 트래픽 흉내.
        // Cache-Control: no-cache로 페이지네이션 캐시 이슈 방지.
        // ⚠️ waitUntil: 'domcontentloaded' 유지 (networkidle은 광고/트래커로 인해 항상 30s timeout까지 대기해 매우 느림).
        // 커뮤니티 사이트는 모두 SSR이라 DOM 로드 시점에 검색 결과가 이미 있음.
        const refererOrigin = new URL(searchUrl).origin;
        await page.setExtraHTTPHeaders({
          Referer: refererOrigin + '/',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        });
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch (navErr) {
        console.warn(
          `${this.source} 검색 페이지 로드 실패 (page ${pageNum}, attempt ${attempt}):`,
          navErr,
        );
        if (attempt < MAX_ATTEMPTS) {
          await sleep(3000 * attempt, 5000 * attempt);
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

      // 차단으로 판정되는 경우: 지수 백오프 후 재시도 (강화)
      if (postLinks.length === 0 && this.detectBlocked(html)) {
        const backoffMs = 8000 * Math.pow(2, attempt - 1); // 8s → 16s → 32s
        console.warn(
          `${this.source} 검색 차단 감지 (page ${pageNum}, attempt ${attempt}, html_len=${html.length}) -- ${backoffMs}ms 백오프`,
        );
        if (attempt < MAX_ATTEMPTS) {
          await sleep(backoffMs, backoffMs + 3000);
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
