/**
 * TTL 기반 증분 수집 정책 상수 및 설정 (env 오버라이드 가능)
 *
 * 정책을 컬럼으로 DB에 저장하지 않는 이유: 변경 시 마이그레이션 없이 재조정 가능.
 * 각 env 변수는 초(second) 단위.
 */

function readInt(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getArticleContentTtlSec(): number {
  return readInt('ARTICLE_CONTENT_TTL_SEC', 21600); // 6h
}

export function getArticleCommentTtlSec(): number {
  return readInt('ARTICLE_COMMENT_TTL_SEC', 1800); // 30m
}

export function getVideoMetaTtlSec(): number {
  return readInt('VIDEO_META_TTL_SEC', 43200); // 12h
}

export function getVideoCommentTtlSec(): number {
  return readInt('VIDEO_COMMENT_TTL_SEC', 3600); // 1h
}

export function getCommunityPostTtlSec(): number {
  return readInt('COMMUNITY_POST_TTL_SEC', 7200); // 2h
}

/**
 * 소스별 본문/댓글 TTL 매핑
 * 알 수 없는 소스는 기사 기본값으로 폴백
 */
export function getContentTtlSecFor(source: string): number {
  if (source === 'naver') return getArticleContentTtlSec();
  if (source === 'youtube') return getVideoMetaTtlSec();
  // dcinside, fmkorea, clien, nate 등 커뮤니티
  return getCommunityPostTtlSec();
}

export function getCommentTtlSecFor(source: string): number {
  if (source === 'youtube') return getVideoCommentTtlSec();
  // 네이버 기사 댓글, 커뮤니티 댓글 모두 동일 정책
  return getArticleCommentTtlSec();
}

/**
 * 전역 재사용 비활성 스위치.
 * DISABLE_REUSE=1 설정 시 planReuse는 항상 빈 계획을 리턴.
 */
export function isReuseDisabled(): boolean {
  const raw = process.env.DISABLE_REUSE;
  return raw === '1' || raw === 'true';
}

/**
 * Redis 컨텐츠 캐시 비활성 스위치 (재사용 판정은 유지, 캐시만 비활성).
 */
export function isContentCacheDisabled(): boolean {
  const raw = process.env.DISABLE_CONTENT_CACHE;
  return raw === '1' || raw === 'true';
}

/**
 * 키워드 정규화 — article_keywords / video_keywords에 저장/조회 시 공통 적용.
 * 소문자 + trim + 내부 연속 공백 축약. 대소문자·공백 변주로 인한 캐시 미스 방지.
 */
export function normalizeKeyword(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}
