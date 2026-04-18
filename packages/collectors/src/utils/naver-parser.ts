// 네이버 뉴스 기사 URL 파싱 유틸리티

/**
 * 네이버 뉴스 기사 URL에서 oid(언론사 코드)와 aid(기사 번호) 추출
 * URL 패턴:
 *   - https://n.news.naver.com/article/{oid}/{aid}
 *   - https://news.naver.com/main/read.nhn?oid=xxx&aid=xxx
 */
export function parseNaverArticleUrl(url: string): { oid: string; aid: string } | null {
  // 패턴 1: https://n.news.naver.com/article/{oid}/{aid} 또는 /mnews/article/{oid}/{aid}
  const match1 = url.match(/n\.news\.naver\.com\/(?:mnews\/)?article\/(\d+)\/(\d+)/);
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
 *
 * 중요: ds/de 만으로는 기간 필터가 적용되지 않는다. 반드시 `pd=3`(기간 상세) 및
 * `nso=so:r,p:fromYYYYMMDDtoYYYYMMDD`를 함께 넣어야 네이버가 기간 필터를 실제로 적용한다.
 * 이 파라미터가 없으면 최신 기사만 반환되어 날짜별 분할 수집이 무의미해진다.
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

  // YYYY.MM.DD (ds/de용), YYYYMMDD (nso용) 두 형식 모두 필요
  const pad = (n: number) => String(n).padStart(2, '0');
  const ds = `${startD.getFullYear()}.${pad(startD.getMonth() + 1)}.${pad(startD.getDate())}`;
  const de = `${endD.getFullYear()}.${pad(endD.getMonth() + 1)}.${pad(endD.getDate())}`;
  const nsoStart = `${startD.getFullYear()}${pad(startD.getMonth() + 1)}${pad(startD.getDate())}`;
  const nsoEnd = `${endD.getFullYear()}${pad(endD.getMonth() + 1)}${pad(endD.getDate())}`;

  const start = (params.page - 1) * 10 + 1;
  const sort = params.sort ?? 1; // 기본 최신순
  // nso의 sort(so): r=관련도, da=최신, ddate=오래된순. 여기선 sort=1(최신)=da, 그 외는 r.
  const nsoSort = sort === 1 ? 'da' : sort === 2 ? 'ddate' : 'r';
  const nso = `so:${nsoSort},p:from${nsoStart}to${nsoEnd}`;

  const qs = new URLSearchParams({
    where: 'news',
    ssc: 'tab.news.all',
    query: params.keyword,
    sm: 'tab_opt',
    sort: String(sort),
    pd: '3', // 기간 상세 필터 활성화 — 반드시 필요
    ds,
    de,
    nso, // ds/de와 반드시 함께 전달
    start: String(start),
  });

  return `https://search.naver.com/search.naver?${qs.toString()}`;
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
