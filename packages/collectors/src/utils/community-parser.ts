// 커뮤니티 수집 공통 유틸리티

/**
 * 커뮤니티 날짜 텍스트를 Date 객체로 변환
 * 지원 형식: "N시간 전", "N분 전", "N일 전", "YYYY.MM.DD", "MM.DD HH:mm"
 */
export function parseDateText(text: string): Date {
  if (!text) return new Date();

  // "N시간 전", "N분 전", "N일 전" 형식
  const relativeMatch = text.match(/(\d+)(시간|분|일)\s*전/);
  if (relativeMatch) {
    const now = new Date();
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];
    if (unit === '시간') now.setHours(now.getHours() - amount);
    else if (unit === '분') now.setMinutes(now.getMinutes() - amount);
    else if (unit === '일') now.setDate(now.getDate() - amount);
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
 * 사이트별 검색 URL 생성
 */
export function buildSearchUrl(
  site: 'dcinside' | 'fmkorea' | 'clien',
  keyword: string,
  page: number,
): string {
  const encoded = encodeURIComponent(keyword);

  switch (site) {
    case 'dcinside':
      return `https://search.dcinside.com/post/p/${page}/sort/accuracy/q/${encoded}`;

    case 'fmkorea':
      // mid 생략 → 전체 통합 검색 (XE/Rhymix IS 모듈)
      return `https://www.fmkorea.com/index.php?act=IS&is_keyword=${encoded}&where=document&page=${page}`;

    case 'clien':
      return `https://www.clien.net/service/search?q=${encoded}&sort=recency&p=${page - 1}`;

    default:
      throw new Error(`Unknown site: ${site}`);
  }
}
