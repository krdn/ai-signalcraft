// 커뮤니티 수집 공통 유틸리티

/**
 * KST(한국) 기준 Y/M/D/H/M/S 값으로 Date 객체 생성 — 컨테이너 TZ 무관.
 * 한국 커뮤니티(fmkorea/dcinside/clien) 게시글 시각이 KST이므로 +09:00 명시 ISO로 안전하게 생성.
 */
function dateFromKst(
  year: number,
  month: number, // 1-12
  day: number,
  hour = 0,
  min = 0,
  sec = 0,
): Date {
  const pad = (n: number) => String(n).padStart(2, '0');
  return new Date(`${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(min)}:${pad(sec)}+09:00`);
}

/**
 * 현재 시각 기준 KST 연·월·일을 반환 (상대시간 보정 시 "올해" 결정에 사용).
 */
function currentKstYearMonth(): { year: number; month: number } {
  const KST_OFFSET = 9 * 60 * 60 * 1000;
  const kstNow = new Date(Date.now() + KST_OFFSET);
  return { year: kstNow.getUTCFullYear(), month: kstNow.getUTCMonth() + 1 };
}

/**
 * 커뮤니티 날짜 텍스트를 Date 객체로 변환 (KST 기준 절대 시각으로 해석).
 * 지원 형식: "N시간 전", "N분 전", "N일 전", "YYYY.MM.DD", "YYYY-MM-DD", "MM.DD HH:mm"
 *
 * ⚠️ 한국 사이트 텍스트는 KST임을 가정 — 컨테이너 TZ가 UTC라도 +09:00 명시 ISO로 변환하여
 * 일자별 cap·기간 필터의 정합성을 보장한다.
 */
export function parseDateText(text: string): Date {
  if (!text) return new Date();

  // "N시간 전" 등 상대시간은 절대 시각이므로 TZ 무관 — 그대로 사용.
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

  // "YYYY.MM.DD"·"YYYY-MM-DD" 형식 (시간 포함 가능: "YYYY-MM-DD HH:mm[:ss]")
  const fullDateMatch = text.match(
    /(\d{4})[.-](\d{1,2})[.-](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/,
  );
  if (fullDateMatch) {
    return dateFromKst(
      parseInt(fullDateMatch[1], 10),
      parseInt(fullDateMatch[2], 10),
      parseInt(fullDateMatch[3], 10),
      fullDateMatch[4] ? parseInt(fullDateMatch[4], 10) : 0,
      fullDateMatch[5] ? parseInt(fullDateMatch[5], 10) : 0,
      fullDateMatch[6] ? parseInt(fullDateMatch[6], 10) : 0,
    );
  }

  // "MM.DD HH:mm" 형식 (올해 KST 기준)
  const shortDateMatch = text.match(/^(\d{1,2})\.(\d{1,2})\s+(\d{1,2}):(\d{1,2})$/);
  if (shortDateMatch) {
    const { year } = currentKstYearMonth();
    return dateFromKst(
      year,
      parseInt(shortDateMatch[1], 10),
      parseInt(shortDateMatch[2], 10),
      parseInt(shortDateMatch[3], 10),
      parseInt(shortDateMatch[4], 10),
    );
  }

  // "MM/DD HH:mm" 형식 (슬래시 구분, 올해 KST)
  const slashDateMatch = text.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2})$/);
  if (slashDateMatch) {
    const { year } = currentKstYearMonth();
    return dateFromKst(
      year,
      parseInt(slashDateMatch[1], 10),
      parseInt(slashDateMatch[2], 10),
      parseInt(slashDateMatch[3], 10),
      parseInt(slashDateMatch[4], 10),
    );
  }

  return new Date();
}

/**
 * KST(UTC+9) 시간대 상수 — 일자별 cap·기간 필터의 정합성 기준.
 * 컨테이너 TZ가 UTC라도 사용자(한국)가 보는 일자와 정확히 일치시키기 위해 사용한다.
 */
export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 주어진 시각이 속한 KST 자정의 epoch ms를 반환.
 * 일자별 cap의 dayKey, splitIntoDaysKst의 시작점 등으로 사용.
 *
 * 예) 컨테이너 UTC, KST 04-17 02:00 글 → UTC 04-16 17:00 →
 *   기존 setHours(0,0,0,0): UTC 04-16 자정 = KST 04-16 09:00 (잘못된 일자)
 *   kstDayStartMs: KST 04-17 자정 = UTC 04-16 15:00 (올바른 일자)
 */
export function kstDayStartMs(d: Date): number {
  const t = d.getTime();
  // KST 자정 = (UTC ms + 9h) / 1일 의 floor → 다시 -9h
  return Math.floor((t + KST_OFFSET_MS) / 86400000) * 86400000 - KST_OFFSET_MS;
}

/**
 * KST 자정 기준으로 [startISO, endISO]를 일별 Date 배열로 분할.
 * 각 Date는 해당 일자의 KST 자정(00:00:00 +09:00)을 가리킨다. 최소 1일 보장.
 *
 * 컨테이너 TZ에 의존하던 기존 setHours(0,0,0,0) 방식은 UTC 컨테이너에서 KST 자정과 9h 어긋나
 * 새벽 시간 글이 인접 일자로 분류되는 문제가 있었음 → 이 함수가 표준.
 */
export function splitIntoDaysKst(startISO: string, endISO: string): Date[] {
  const startMs = kstDayStartMs(new Date(startISO));
  const endMs = kstDayStartMs(new Date(endISO));
  const days: Date[] = [];
  for (let t = startMs; t <= endMs; t += 86400000) {
    days.push(new Date(t));
  }
  if (days.length === 0) days.push(new Date(startMs));
  return days;
}

/**
 * KST 기준 연·월·일을 추출 (컨테이너 TZ 무관).
 * 네이버 ds/de(YYYY.MM.DD) 등 "사용자가 보는 일자"로 외부 API에 전달할 때 사용.
 */
export function getKstYmd(d: Date): { year: number; month: number; day: number } {
  const kst = new Date(d.getTime() + KST_OFFSET_MS);
  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth() + 1,
    day: kst.getUTCDate(),
  };
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

  // "YYYY.MM.DD"·"YYYY-MM-DD" 형식 (시간/초 포함 가능) — KST 기준 절대 시각으로 해석.
  // 네이버 뉴스 검색은 "YYYY.MM.DD."처럼 trailing dot이 붙는 경우도 있음 — 정규식이 허용함.
  const fullDateMatch = text.match(
    /(\d{4})[.-](\d{1,2})[.-](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/,
  );
  if (fullDateMatch) {
    return dateFromKst(
      parseInt(fullDateMatch[1], 10),
      parseInt(fullDateMatch[2], 10),
      parseInt(fullDateMatch[3], 10),
      fullDateMatch[4] ? parseInt(fullDateMatch[4], 10) : 0,
      fullDateMatch[5] ? parseInt(fullDateMatch[5], 10) : 0,
      fullDateMatch[6] ? parseInt(fullDateMatch[6], 10) : 0,
    );
  }

  // "MM.DD HH:mm" 형식 (올해 KST)
  const shortDateMatch = text.match(/^(\d{1,2})\.(\d{1,2})\s+(\d{1,2}):(\d{1,2})$/);
  if (shortDateMatch) {
    const { year } = currentKstYearMonth();
    return dateFromKst(
      year,
      parseInt(shortDateMatch[1], 10),
      parseInt(shortDateMatch[2], 10),
      parseInt(shortDateMatch[3], 10),
      parseInt(shortDateMatch[4], 10),
    );
  }

  // "MM/DD HH:mm" 형식 (올해 KST)
  const slashDateMatch = text.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2})$/);
  if (slashDateMatch) {
    const { year } = currentKstYearMonth();
    return dateFromKst(
      year,
      parseInt(slashDateMatch[1], 10),
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
      // sort/latest로 등록일 최신순. 기본 sort/accuracy(정확도순)는 fmkorea와 동일하게
      // 최근 일자가 상위에 쏠려 과거 일자가 묻히는 문제가 있어 시간순으로 통일.
      return `https://search.dcinside.com/post/p/${page}/sort/latest/q/${encoded}`;

    case 'fmkorea': {
      // search.php는 s_date/e_date(YYYY-MM-DD) + search_target=1로 날짜 필터 지원.
      // 기본은 관련도순이라 04-16~04-18처럼 최근 일자에 글이 쏠리면 과거 일자가 묻힘 →
      // order_type=desc&sort_index=regdate로 등록일 최신순 정렬을 강제해
      // 페이지를 깊이 내려갈수록 자연스럽게 과거 일자에 도달하도록 한다.
      let url = `https://www.fmkorea.com/search.php?act=IS&is_keyword=${encoded}&where=document&order_type=desc&sort_index=regdate&page=${page}`;
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
