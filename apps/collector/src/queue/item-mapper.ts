import { createHash } from 'node:crypto';
import type { NewRawItem } from '../db/schema';
import type { CollectorSource } from './types';

/**
 * 외부 어댑터의 다양한 item 타입을 raw_items 스키마로 통일.
 *
 * 기존 어댑터(@ai-signalcraft/collectors)는 소스별로 다른 필드명을 반환한다:
 *   - naver-news: { sourceId, url, title, content, publishedAt, rawData }
 *   - youtube-videos: { videoId, title, description, channelTitle, viewCount, ... }
 *   - dcinside/fmkorea/clien: CommunityPost { id, url, title, content, author, createdAt }
 *
 * 이 레이어는 어댑터 타입을 "구조적"으로 해석한다 (덕 타이핑).
 * 수집 후 DB 삽입 직전에 호출.
 */

type AnyItem = Record<string, unknown>;

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * publishedAt이 없는 아이템을 위한 time 폴백.
 *
 * TimescaleDB UNIQUE (source, source_id, item_type, time) 제약은 시간 컬럼을
 * 포함해야 하는데, publishedAt이 null일 때 `new Date()`를 쓰면 재수집마다
 * time이 달라져 UNIQUE가 무력화되어 중복이 쌓인다.
 *
 * 수집 시각을 UTC 자정으로 절삭하면 같은 날 안에서는 time이 일정해 중복이
 * `onConflictDoNothing`으로 차단되고, 청크 분포도 날짜별로 자연스럽게 유지된다.
 */
function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function pickString(obj: AnyItem, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

function pickNumber(obj: AnyItem, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  }
  return null;
}

/**
 * 어댑터의 sourceId가 없으면 URL 해시로 대체 (마지막 방어선).
 */
function ensureSourceId(item: AnyItem, source: CollectorSource): string {
  const explicit = pickString(item, 'sourceId', 'id', 'videoId', 'commentId');
  if (explicit) return explicit;
  const url = pickString(item, 'url', 'link');
  if (url) return createHash('sha1').update(`${source}:${url}`).digest('hex').slice(0, 40);
  // 최후의 수단 — 텍스트 해시
  const title = pickString(item, 'title') ?? '';
  const content = pickString(item, 'content', 'description') ?? '';
  return createHash('sha1')
    .update(`${source}:${title}:${content}`.slice(0, 500))
    .digest('hex')
    .slice(0, 40);
}

export interface MapItemContext {
  subscriptionId: number;
  source: CollectorSource;
  itemType: 'article' | 'video' | 'comment';
  runId: string;
}

export function mapToRawItem(raw: AnyItem, ctx: MapItemContext): NewRawItem {
  const publishedAt =
    toDate(raw.publishedAt) ??
    toDate(raw.createdAt) ??
    toDate(raw.publishDate) ??
    toDate(raw.timestamp);

  // time = 게시일 우선, 없으면 오늘 UTC 자정 (같은 날 재수집 중복 차단용)
  const time = publishedAt ?? startOfUtcDay(new Date());

  const metrics: NewRawItem['metrics'] = {
    viewCount: pickNumber(raw, 'viewCount', 'views') ?? undefined,
    likeCount: pickNumber(raw, 'likeCount', 'likes') ?? undefined,
    commentCount: pickNumber(raw, 'commentCount', 'comments') ?? undefined,
    shareCount: pickNumber(raw, 'shareCount') ?? undefined,
  };

  return {
    time,
    subscriptionId: ctx.subscriptionId,
    source: ctx.source,
    sourceId: ensureSourceId(raw, ctx.source),
    itemType: ctx.itemType,
    url: pickString(raw, 'url', 'link'),
    title: pickString(raw, 'title'),
    content: pickString(raw, 'content', 'description', 'text', 'body'),
    author: pickString(raw, 'author', 'channelTitle', 'username', 'nickname'),
    publisher: pickString(raw, 'publisher', 'channelTitle'),
    publishedAt,
    parentSourceId: pickString(
      raw,
      'articleSourceId',
      'articleId',
      'videoSourceId',
      'videoId',
      'postId',
      'parentId',
    ),
    metrics,
    rawPayload: raw,
    fetchedFromRun: ctx.runId,
  };
}
