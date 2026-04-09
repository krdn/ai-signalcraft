/**
 * SSRF 방어: 외부 URL이 사설 IP 대역을 가리키지 않는지 검증.
 * - HTTP/HTTPS 프로토콜만 허용
 * - IPv4 사설 대역(10/8, 172.16/12, 192.168/16, 127/8, 169.254/16)과 IPv6 루프백 차단
 * - 호스트가 IP가 아닌 도메인이면 통과(DNS 해석 단계는 런타임 fetch에서 추가 검증 가능)
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export function parseSafeUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError(`유효하지 않은 URL: ${rawUrl}`);
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new UnsafeUrlError(`허용되지 않은 프로토콜: ${url.protocol}`);
  }
  if (isPrivateHost(url.hostname)) {
    throw new UnsafeUrlError(`사설 IP 대역은 접근할 수 없습니다: ${url.hostname}`);
  }
  return url;
}

export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  // IPv6 loopback / unspecified
  if (host === '::1' || host === '[::1]' || host === '::' || host === '[::]') return true;
  // Bracketed IPv6
  const ipv6 = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  if (ipv6.includes(':')) {
    // fe80::/10 link-local, fc00::/7 unique local
    if (
      ipv6.startsWith('fe8') ||
      ipv6.startsWith('fe9') ||
      ipv6.startsWith('fea') ||
      ipv6.startsWith('feb')
    )
      return true;
    if (ipv6.startsWith('fc') || ipv6.startsWith('fd')) return true;
    return false;
  }
  // IPv4
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false; // 도메인 — 1차 검증 통과
  const [a, b] = match.slice(1).map(Number);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  return false;
}

export function sha1(input: string): string {
  // crypto.subtle은 async라 Node crypto로 sync hash 생성
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require('node:crypto') as typeof import('node:crypto');
  return createHash('sha1').update(input).digest('hex');
}
