// Playwright 브라우저 launch 옵션 — Docker 환경에서 시스템 Chromium 사용
import { chromium, type Browser, type BrowserContext } from 'playwright';

// User-Agent 로테이션 (3개 어댑터 공통)
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
];

/** 랜덤 User-Agent 반환 */
export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/** 브라우저 컨텍스트 기본 옵션 (한국 로케일 + 서울 타임존) */
export const DEFAULT_CONTEXT_OPTIONS = {
  locale: 'ko-KR' as const,
  timezoneId: 'Asia/Seoul' as const,
};

/** 한국 로케일 + 랜덤 UA로 브라우저 컨텍스트 생성 */
export async function createBrowserContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    ...DEFAULT_CONTEXT_OPTIONS,
    userAgent: getRandomUserAgent(),
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
