// 커뮤니티 수집 공통 유틸리티

/**
 * 커뮤니티 날짜 텍스트를 Date 객체로 변환
 * 지원 형식: "N시간 전", "N분 전", "N일 전", "YYYY.MM.DD", "MM.DD HH:mm"
 */
export function parseDateText(text: string): Date {
  if (!text) return new Date();

  // "N시간 전", "N분 전", "N일 전", "N주 전", "N달/개월 전", "N년 전" 형식
  const relativeMatch = text.match(/(\d+)\s*(시간|분|일|주|달|개월|년)\s*전/);
  if (relativeMatch) {
    const now = new Date();
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];
    if (unit === '시간') now.setHours(now.getHours() - amount);
    else if (unit === '분') now.setMinutes(now.getMinutes() - amount);
    else if (unit === '일') now.setDate(now.getDate() - amount);
    else if (unit === '주') now.setDate(now.getDate() - amount * 7);
    else if (unit === '달' || unit === '개월') now.setMonth(now.getMonth() - amount);
    else if (unit === '년') now.setFullYear(now.getFullYear() - amount);
    return now;
  }

  // "YYYY.MM.DD" 형식 (시간 포함 가능: "YYYY.MM.DD HH:mm")
  const fullDateMatch = text.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (fullDateMatch) {
    const year = parseInt(fullDateMatch[1], 10);
    const month = parseInt(fullDateMatch[2], 10) - 1; // 0-indexed
    const day = parseInt(fullDateMatch[3], 10);
    const hour = fullDateMatch[4] ? parseInt(fullDateMatch[4], 10) : 0;
    const min = fullDateMatch[5] ? parseInt(fullDateMatch[5], 10) : 0;
    return new Date(year, month, day, hour, min);
  }

  // "MM.DD HH:mm" 형식 (올해 기준)
  const shortDateMatch = text.match(/^(\d{1,2})\.(\d{1,2})\s+(\d{1,2}):(\d{1,2})$/);
  if (shortDateMatch) {
    const now = new Date();
    const month = parseInt(shortDateMatch[1], 10) - 1;
    const day = parseInt(shortDateMatch[2], 10);
    const hour = parseInt(shortDateMatch[3], 10);
    const min = parseInt(shortDateMatch[4], 10);
    return new Date(now.getFullYear(), month, day, hour, min);
  }

  // "MM/DD HH:mm" 형식 (슬래시 구분)
  const slashDateMatch = text.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2})$/);
  if (slashDateMatch) {
    const now = new Date();
    const month = parseInt(slashDateMatch[1], 10) - 1;
    const day = parseInt(slashDateMatch[2], 10);
    const hour = parseInt(slashDateMatch[3], 10);
    const min = parseInt(slashDateMatch[4], 10);
    return new Date(now.getFullYear(), month, day, hour, min);
  }

  return new Date();
}

/**
 * 반봇 대응 랜덤 딜레이 값 생성 (ms)
 * 실제 딜레이 적용은 호출자가 setTimeout으로 처리
 */
export function randomDelay(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * 랜덤 딜레이를 Promise로 반환 (async 코드에서 await 가능)
 */
export function sleep(min: number, max?: number): Promise<void> {
  const ms = max ? randomDelay(min, max) : min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * HTML 태그 제거, 텍스트만 추출
 */
export function sanitizeContent(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n') // <br> -> 줄바꿈
    .replace(/<[^>]*>/g, '') // HTML 태그 제거
    .replace(/&nbsp;/g, ' ') // &nbsp; -> 공백
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ') // 연속 공백 정리
    .trim();
}

/**
 * 날짜 텍스트를 Date 객체로 변환 -- 파싱 실패 시 null 반환
 * naver-news 등 null 체크가 필요한 곳에서 사용
 */
export function parseDateTextOrNull(text: string): Date | null {
  if (!text) return null;

  // "N시간 전", "N분 전", "N일 전", "N주 전", "N달/개월 전", "N년 전" 형식
  const relativeMatch = text.match(/(\d+)\s*(시간|분|일|주|달|개월|년)\s*전/);
  if (relativeMatch) {
    const now = new Date();
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];
    if (unit === '시간') now.setHours(now.getHours() - amount);
    else if (unit === '분') now.setMinutes(now.getMinutes() - amount);
    else if (unit === '일') now.setDate(now.getDate() - amount);
    else if (unit === '주') now.setDate(now.getDate() - amount * 7);
    else if (unit === '달' || unit === '개월') now.setMonth(now.getMonth() - amount);
    else if (unit === '년') now.setFullYear(now.getFullYear() - amount);
    return now;
  }

  // "YYYY.MM.DD" 형식 (시간 포함 가능: "YYYY.MM.DD HH:mm")
  // 네이버 뉴스 검색은 "YYYY.MM.DD." 처럼 trailing dot이 붙는 경우도 있음 — 정규식이 허용함.
  const fullDateMatch = text.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (fullDateMatch) {
    const year = parseInt(fullDateMatch[1], 10);
    const month = parseInt(fullDateMatch[2], 10) - 1;
    const day = parseInt(fullDateMatch[3], 10);
    const hour = fullDateMatch[4] ? parseInt(fullDateMatch[4], 10) : 0;
    const min = fullDateMatch[5] ? parseInt(fullDateMatch[5], 10) : 0;
    return new Date(year, month, day, hour, min);
  }

  // "MM.DD HH:mm" 형식
  const shortDateMatch = text.match(/^(\d{1,2})\.(\d{1,2})\s+(\d{1,2}):(\d{1,2})$/);
  if (shortDateMatch) {
    const now = new Date();
    return new Date(
      now.getFullYear(),
      parseInt(shortDateMatch[1], 10) - 1,
      parseInt(shortDateMatch[2], 10),
      parseInt(shortDateMatch[3], 10),
      parseInt(shortDateMatch[4], 10),
    );
  }

  // "MM/DD HH:mm" 형식
  const slashDateMatch = text.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2})$/);
  if (slashDateMatch) {
    const now = new Date();
    return new Date(
      now.getFullYear(),
      parseInt(slashDateMatch[1], 10) - 1,
      parseInt(slashDateMatch[2], 10),
      parseInt(slashDateMatch[3], 10),
      parseInt(slashDateMatch[4], 10),
    );
  }

  return null;
}

/**
 * 사이트별 검색 URL 생성
 */
export function buildSearchUrl(
  site: 'dcinside' | 'fmkorea' | 'clien',
  keyword: string,
  page: number,
  dateRange?: { start: string; end: string }, // ISO 문자열, 선택적 날짜 필터 (지원 사이트만 사용)
): string {
  const encoded = encodeURIComponent(keyword);

  switch (site) {
    case 'dcinside':
      return `https://search.dcinside.com/post/p/${page}/sort/accuracy/q/${encoded}`;

    case 'fmkorea': {
      // search.php는 s_date/e_date(YYYY-MM-DD) + search_target=1로 날짜 필터 지원.
      // 기본 URL은 관련도순 전체 검색이라 최신순으로 정렬되어 과거 일자가 묻히는 문제가 있음.
      let url = `https://www.fmkorea.com/search.php?act=IS&is_keyword=${encoded}&where=document&page=${page}`;
      if (dateRange) {
        const toYmd = (iso: string) => {
          const d = new Date(iso);
          if (Number.isNaN(d.getTime())) return null;
          const pad = (n: number) => String(n).padStart(2, '0');
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        };
        const s = toYmd(dateRange.start);
        const e = toYmd(dateRange.end);
        if (s && e) {
          url += `&search_target=1&s_date=${s}&e_date=${e}`;
        }
      }
      return url;
    }

    case 'clien':
      return `https://www.clien.net/service/search?q=${encoded}&sort=recency&p=${page - 1}`;

    default:
      throw new Error(`Unknown site: ${site}`);
  }
}
