// 네이버 뉴스 댓글 수집기 (비공식 API)
import type { Collector, CollectionOptions } from './base';
import { parseNaverArticleUrl, buildObjectId, buildCommentApiUrl } from '../utils/naver-parser';

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
  async *collect(options: CollectionOptions): AsyncGenerator<NaverComment[], void, unknown> {
    // collect 인터페이스는 keyword 기반이지만
    // 댓글 수집은 기사 URL이 필요한 특수한 경우
    // 별도 collectForArticle 메서드로 기사별 수집 가능
    // 기본 collect는 빈 제너레이터 (파이프라인에서 기사 URL 전달받아 사용)
    return;
  }

  /**
   * 특정 기사의 댓글 수집
   * 실제 파이프라인에서 사용하는 메서드
   */
  async *collectForArticle(
    articleUrl: string,
    options?: { maxComments?: number },
  ): AsyncGenerator<NaverComment[], void, unknown> {
    const parsed = parseNaverArticleUrl(articleUrl);
    if (!parsed) {
      throw new Error(`네이버 뉴스 URL을 파싱할 수 없습니다: ${articleUrl}`);
    }

    const { oid, aid } = parsed;
    const objectId = buildObjectId(oid, aid);
    const articleSourceId = `${oid}_${aid}`;
    const maxComments = options?.maxComments ?? DEFAULT_MAX_COMMENTS;
    let totalCollected = 0;
    let currentPage = 1;

    // Referer 헤더 -- 기사 댓글 페이지 URL (필수, 없으면 403)
    const referer = `https://n.news.naver.com/article/comment/${oid}/${aid}`;

    while (totalCollected < maxComments) {
      const apiUrl = buildCommentApiUrl({
        objectId,
        page: currentPage,
        pageSize: 100,
        sort: 'FAVORITE',
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
      for (const raw of commentList) {
        if (totalCollected >= maxComments) break;

        comments.push({
          sourceId: String(raw.commentNo ?? raw.ticket ?? ''),
          parentId: raw.parentCommentNo ? String(raw.parentCommentNo) : null,
          articleSourceId,
          content: String(raw.contents ?? ''),
          author: String(raw.maskedUserId ?? raw.userName ?? '익명'),
          likeCount: Number(raw.sympathyCount ?? 0),
          dislikeCount: Number(raw.antipathyCount ?? 0),
          publishedAt: raw.modTime
            ? new Date(String(raw.modTime))
            : raw.regTime
              ? new Date(String(raw.regTime))
              : null,
          rawData: raw,
        });

        totalCollected++;
      }

      if (comments.length > 0) {
        yield comments;
      }

      // 전체 페이지 확인
      const pageModel = result.pageModel as Record<string, unknown> | undefined;
      const totalPages = Number(pageModel?.totalPages ?? 1);
      if (currentPage >= totalPages) break;

      currentPage++;
      await delay(REQUEST_DELAY_MS, REQUEST_DELAY_MS + 500);
    }
  }
}
