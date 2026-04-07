/** Rate limit / 서버 과부하 판별 및 재시도 유틸 (DB 의존 없음) */

export const MAX_RATE_LIMIT_RETRIES = 3;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('rate limit') ||
    msg.includes('429') ||
    msg.includes('too many requests') ||
    msg.includes('quota')
  );
}

export function isServerOverloadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('overloaded') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('server error')
  );
}

export function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('aborted') ||
    error.name === 'AbortError' ||
    error.name === 'TimeoutError'
  );
}

export function parseRetryAfter(error: unknown): number {
  if (!(error instanceof Error)) return 0;
  const match = error.message.match(/retry(?:-|\s)after[:\s]+(\d+)/i);
  if (match) return parseInt(match[1], 10);
  return 0;
}
