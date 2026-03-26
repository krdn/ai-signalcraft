// Playwright 브라우저 launch 옵션 — Docker 환경에서 시스템 Chromium 사용
import { chromium, type Browser } from 'playwright';

export async function launchBrowser(): Promise<Browser> {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  return chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
}
