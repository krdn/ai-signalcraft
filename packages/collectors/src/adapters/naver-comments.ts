// 네이버 뉴스 댓글 수집기 (비공식 API)
import { parseNaverArticleUrl, buildObjectId, buildCommentApiUrl } from '../utils/naver-parser';
import type { Collector, CollectionOptions } from './base';

/** 수집된 네이버 뉴스 댓글 */
export interface NaverComment {
  sourceId: string; // 댓글 고유 ID
  parentId: string | null; // 대댓글인 경우 부모 ID
  articleSourceId: string; // 소속 기사의 sourceId (oid_aid)
  content: string;
  author: string;
  likeCount: number;
  dislikeCount: number;
  publishedAt: Date | null;
  rawData: Record<string, unknown>;
}

// 기본 최대 댓글 수집 건수
const DEFAULT_MAX_COMMENTS = 500;
// 요청 간 딜레이 (네이버 댓글 API는 ~10req/s 허용, 500ms면 충분)
const REQUEST_DELAY_MS = 500;

// 필수 헤더 (Referer 없으면 403 차단)
const BASE_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
};

/**
 * 랜덤 딜레이 (min ~ max ms)
 */
function delay(minMs: number, maxMs?: number): Promise<void> {
  const ms = maxMs ? minMs + Math.random() * (maxMs - minMs) : minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * JSONP 응답에서 JSON 추출
 * _callback({...}) 형식의 래퍼를 제거하고 JSON.parse
 */
function parseJsonpResponse(text: string): unknown {
  // JSONP 래퍼 패턴: _callback({...})
  const match = text.match(/^[a-zA-Z_$][\w$]*\(([\s\S]*)\);?\s*$/);
  if (match) {
    return JSON.parse(match[1]);
  }
  // 이미 순수 JSON인 경우
  return JSON.parse(text);
}

/**
 * NaverCommentsCollector
 *
 * 비공식 네이버 댓글 API를 사용하여 기사별 댓글을 수집한다.
 * AsyncGenerator로 기사 단위로 댓글을 yield한다.
 */
export class NaverCommentsCollector implements Collector<NaverComment> {
  readonly source = 'naver-comments';

  /**
   * 키워드 기반 수집 (collect 인터페이스 구현)
   * 주의: 댓글 수집은 보통 기사 URL 목록이 필요하므로,
   * 이 메서드는 단독 사용보다 NaverNewsCollector와 함께 사용하는 것을 권장
   */
  async *collect(_options: CollectionOptions): AsyncGenerator<NaverComment[], void, unknown> {
    // collect 인터페이스는 keyword 기반이지만
    // 댓글 수집은 기사 URL이 필요한 특수한 경우
    // 별도 collectForArticle 메서드로 기사별 수집 가능
    // 기본 collect는 빈 제너레이터 (파이프라인에서 기사 URL 전달받아 사용)
    yield []; // require-yield: 빈 배열 yield로 Generator 계약 충족
    return;
  }

  /**
   * 특정 기사의 댓글 수집
   * 실제 파이프라인에서 사용하는 메서드
   *
   * since 증분 모드:
   * - since 지정 시 sort를 'NEW'로 전환해 최신순으로 받는다.
   * - publishedAt <= since 인 댓글이 연속 OLD_CONSECUTIVE_CUTOFF(20)개 나오면 조기 종료.
   * - 결과에는 since 이후 댓글만 포함된다.
   */
  async *collectForArticle(
    articleUrl: string,
    options?: {
      maxComments?: number;
      since?: Date;
      sort?: 'FAVORITE' | 'NEW';
    },
  ): AsyncGenerator<NaverComment[], void, unknown> {
    const parsed = parseNaverArticleUrl(articleUrl);
    if (!parsed) {
      throw new Error(`네이버 뉴스 URL을 파싱할 수 없습니다: ${articleUrl}`);
    }

    const { oid, aid } = parsed;
    const objectId = buildObjectId(oid, aid);
    const articleSourceId = `${oid}_${aid}`;
    const maxComments = options?.maxComments ?? DEFAULT_MAX_COMMENTS;
    const since = options?.since ?? null;
    // since 있으면 최신순(NEW), 없으면 기존 FAVORITE 유지
    const sort: 'FAVORITE' | 'NEW' = options?.sort ?? (since ? 'NEW' : 'FAVORITE');
    const OLD_CONSECUTIVE_CUTOFF = 20;

    let totalCollected = 0;
    let currentPage = 1;
    let consecutiveOld = 0;

    // Referer 헤더 -- 기사 댓글 페이지 URL (필수, 없으면 403)
    const referer = `https://n.news.naver.com/article/comment/${oid}/${aid}`;

    while (totalCollected < maxComments) {
      const apiUrl = buildCommentApiUrl({
        objectId,
        page: currentPage,
        pageSize: 100,
        sort,
      });

      const response = await fetch(apiUrl, {
        headers: {
          ...BASE_HEADERS,
          Referer: referer,
        },
      });

      if (!response.ok) {
        throw new Error(`댓글 API 요청 실패: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      let data: Record<string, unknown>;

      try {
        data = parseJsonpResponse(text) as Record<string, unknown>;
      } catch {
        throw new Error(`댓글 API 응답 파싱 실패 (page ${currentPage})`);
      }

      const result = data.result as Record<string, unknown> | undefined;
      if (!result) break;

      const commentList = result.commentList as Array<Record<string, unknown>> | undefined;
      if (!commentList || commentList.length === 0) break;

      const comments: NaverComment[] = [];
      let stopAfterPage = false; // since cutoff 또는 maxComments 도달 시 yield 후 pageLoop 종료용
      for (const raw of commentList) {
        if (totalCollected >= maxComments) {
          stopAfterPage = true;
          break;
        }

        const publishedAt: Date | null = raw.modTime
          ? new Date(String(raw.modTime))
          : raw.regTime
            ? new Date(String(raw.regTime))
            : null;

        // since 컷오프: publishedAt <= since 이면 "오래된 것"으로 카운트하고 건너뜀
        if (since && publishedAt && publishedAt.getTime() <= since.getTime()) {
          consecutiveOld++;
          if (consecutiveOld >= OLD_CONSECUTIVE_CUTOFF) {
            stopAfterPage = true;
            break;
          }
          continue;
        }
        consecutiveOld = 0;

        comments.push({
          sourceId: String(raw.commentNo ?? raw.ticket ?? ''),
          parentId: raw.parentCommentNo ? String(raw.parentCommentNo) : null,
          articleSourceId,
          content: String(raw.contents ?? ''),
          author: String(raw.maskedUserId ?? raw.userName ?? '익명'),
          likeCount: Number(raw.sympathyCount ?? 0),
          dislikeCount: Number(raw.antipathyCount ?? 0),
          publishedAt,
          rawData: raw,
        });

        totalCollected++;
      }

      // stopAfterPage 여부와 무관하게, 이번 페이지에서 수집된 comments는 먼저 yield
      if (comments.length > 0) {
        yield comments;
      }

      if (stopAfterPage) break;

      // 전체 페이지 확인
      const pageModel = result.pageModel as Record<string, unknown> | undefined;
      const totalPages = Number(pageModel?.totalPages ?? 1);
      if (currentPage >= totalPages) break;

      currentPage++;
      await delay(REQUEST_DELAY_MS, REQUEST_DELAY_MS + 500);
    }
  }
}
