// Playwright 브라우저 launch 옵션 — Docker 환경에서 시스템 Chromium 사용
import { chromium, type Browser, type BrowserContext } from 'playwright';

// UA → sec-ch-ua 버전 동기화. Akamai/Cloudflare 등 봇 감지가 헤더 일관성을 본다.
type UAEntry = {
  ua: string;
  chVersion: string; // sec-ch-ua 메이저 버전 (UA의 Chrome/X와 일치해야 함)
  chPlatform: string; // sec-ch-ua-platform ("Windows" | "macOS" | "Linux")
};

const UA_ENTRIES: UAEntry[] = [
  {
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    chVersion: '131',
    chPlatform: 'Windows',
  },
  {
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    chVersion: '130',
    chPlatform: 'Windows',
  },
  {
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    chVersion: '132',
    chPlatform: 'macOS',
  },
];

/** 랜덤 UA 엔트리 (UA + 동기화된 sec-ch-ua 메타데이터) */
export function pickUserAgentEntry(): UAEntry {
  return UA_ENTRIES[Math.floor(Math.random() * UA_ENTRIES.length)];
}

/** 랜덤 User-Agent 문자열 (하위 호환) */
export function getRandomUserAgent(): string {
  return pickUserAgentEntry().ua;
}

/**
 * Chrome 풀세트 헤더 — Akamai Bot Manager 등이 봇으로 분류하지 않도록 실제 브라우저와 동일한
 * 헤더 시그니처를 만든다. UA와 sec-ch-ua 버전이 일치해야 일관성 통과.
 */
export function buildChromeHeaders(entry: UAEntry, referer?: string): Record<string, string> {
  return {
    'User-Agent': entry.ua,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'sec-ch-ua': `"Chromium";v="${entry.chVersion}", "Google Chrome";v="${entry.chVersion}", "Not_A Brand";v="24"`,
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': `"${entry.chPlatform}"`,
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': referer ? 'same-origin' : 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    ...(referer ? { Referer: referer } : {}),
  };
}

/** 브라우저 컨텍스트 기본 옵션 (한국 로케일 + 서울 타임존) */
export const DEFAULT_CONTEXT_OPTIONS = {
  locale: 'ko-KR' as const,
  timezoneId: 'Asia/Seoul' as const,
};

/**
 * 한국 로케일 + 랜덤 UA + Chrome 풀세트 헤더로 브라우저 컨텍스트 생성.
 * extraHTTPHeaders로 sec-ch-ua* 등을 모든 요청에 동봉 → 첫 페이지 Playwright 방문도 봇 판정 회피.
 */
export async function createBrowserContext(browser: Browser): Promise<BrowserContext> {
  const entry = pickUserAgentEntry();
  const headers = buildChromeHeaders(entry);
  // userAgent는 Playwright 옵션으로 별도 설정해야 navigator.userAgent까지 일치 (extraHTTPHeaders는 헤더만 변경)
  const { 'User-Agent': _ua, ...extraHeaders } = headers;
  return browser.newContext({
    ...DEFAULT_CONTEXT_OPTIONS,
    userAgent: entry.ua,
    extraHTTPHeaders: extraHeaders,
  });
}

/** 랜덤 딜레이 Promise (반봇 대응) */
export function sleep(min: number, max?: number): Promise<void> {
  const ms = max ? min + Math.random() * (max - min) : min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function launchBrowser(): Promise<Browser> {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  return chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}
