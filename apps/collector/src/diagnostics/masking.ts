const TOKEN_RE = /[A-Za-z0-9]{32,}/g;

export function maskSensitive(input: string | null): string | null {
  if (input === null) return null;
  return input.replace(TOKEN_RE, '[REDACTED]');
}

export function truncate(input: string, maxLen: number): string {
  if (input.length <= maxLen) return input;
  return input.slice(0, maxLen - 3) + '...';
}

export function sanitizeError(input: string | null, maxLen = 4096): string | null {
  if (input === null) return null;
  return truncate(maskSensitive(input) ?? '', maxLen);
}
