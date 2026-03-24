// 네이버 뉴스 기사 URL 파싱 유틸리티

/**
 * 네이버 뉴스 기사 URL에서 oid(언론사 코드)와 aid(기사 번호) 추출
 * URL 패턴:
 *   - https://n.news.naver.com/article/{oid}/{aid}
 *   - https://news.naver.com/main/read.nhn?oid=xxx&aid=xxx
 */
export function parseNaverArticleUrl(url: string): { oid: string; aid: string } | null {
  // 패턴 1: https://n.news.naver.com/article/{oid}/{aid}
  const match1 = url.match(/n\.news\.naver\.com\/article\/(\d+)\/(\d+)/);
  if (match1) return { oid: match1[1], aid: match1[2] };

  // 패턴 2: https://news.naver.com/main/read.nhn?oid=xxx&aid=xxx (레거시)
  const match2 = url.match(/[?&]oid=(\d+).*[?&]aid=(\d+)/);
  if (match2) return { oid: match2[1], aid: match2[2] };

  return null;
}

/**
 * 네이버 댓글 API용 objectId 생성
 * 형식: news{oid},{aid}
 */
export function buildObjectId(oid: string, aid: string): string {
  return `news${oid},${aid}`;
}

/**
 * 네이버 뉴스 검색 URL 생성
 * 검색 파라미터: query(키워드), ds/de(시작/종료 날짜 YYYY.MM.DD),
 * start(페이지 오프셋), sort(0=관련도, 1=최신, 2=오래된순)
 */
export function buildNaverSearchUrl(params: {
  keyword: string;
  startDate: string; // ISO 8601
  endDate: string; // ISO 8601
  page: number; // 1-based
  sort?: number; // 0=관련도, 1=최신
}): string {
  const startD = new Date(params.startDate);
  const endD = new Date(params.endDate);

  // YYYY.MM.DD 형식으로 변환
  const ds = `${startD.getFullYear()}.${String(startD.getMonth() + 1).padStart(2, '0')}.${String(startD.getDate()).padStart(2, '0')}`;
  const de = `${endD.getFullYear()}.${String(endD.getMonth() + 1).padStart(2, '0')}.${String(endD.getDate()).padStart(2, '0')}`;

  const start = (params.page - 1) * 10 + 1;
  const sort = params.sort ?? 1; // 기본 최신순

  return `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(params.keyword)}&sm=tab_opt&sort=${sort}&ds=${ds}&de=${de}&start=${start}`;
}

/**
 * 네이버 댓글 API URL 생성
 */
export function buildCommentApiUrl(params: {
  objectId: string;
  page: number;
  pageSize?: number;
  sort?: 'FAVORITE' | 'NEW' | 'OLD';
}): string {
  const pageSize = params.pageSize ?? 100;
  const sort = params.sort ?? 'FAVORITE';

  return `https://apis.naver.com/commentBox/cbox/web_naver_list_jsonp.json?ticket=news&pool=cbox5&lang=ko&objectId=${encodeURIComponent(params.objectId)}&pageSize=${pageSize}&page=${params.page}&sort=${sort}&initialize=true&useAlt498=true&indexSize=10&groupId=&listType=OBJECT`;
}
