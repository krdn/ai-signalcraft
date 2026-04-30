// Collector source enum — server tRPC와 클라이언트 컴포넌트가 공유.
// 별도 모듈로 분리해 'use client' 컴포넌트가 server 의존성을 끌어오지 않도록 한다.
// (변경 시 apps/collector/src/server/trpc/items.ts의 SOURCE_ENUM과 동기 필요)

export const COLLECTOR_SOURCE_ENUM = [
  'naver-news',
  'naver-comments',
  'youtube',
  'dcinside',
  'fmkorea',
  'clien',
] as const;

export type CollectorSourceKey = (typeof COLLECTOR_SOURCE_ENUM)[number];

/** 외부 string을 collector enum으로 안전 변환 — 매칭 안 되면 null */
export function narrowCollectorSource(value: string | null | undefined): CollectorSourceKey | null {
  if (!value) return null;
  return (COLLECTOR_SOURCE_ENUM as readonly string[]).includes(value)
    ? (value as CollectorSourceKey)
    : null;
}
