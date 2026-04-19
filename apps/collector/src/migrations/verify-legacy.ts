/**
 * 레거시 이관 검증: 레거시 DB의 articles/videos/comments 건수와
 * collector DB의 raw_items 건수를 item_type별로 비교.
 *
 * 실행:
 *   LEGACY_DATABASE_URL=postgres://... \
 *   DATABASE_URL=postgres://.../ais_collection \
 *   pnpm --filter @ai-signalcraft/collector exec tsx src/migrations/verify-legacy.ts
 *
 * 종료 코드:
 *   0 — 모든 item_type의 target ≥ source (중복 제거로 target이 작을 순 있음 — 경고만)
 *   1 — 심각한 누락(target < source * 0.9) 또는 연결 실패
 */

import { Pool } from 'pg';

interface LegacyCounts {
  articles: number;
  videos: number;
  comments: number;
}

interface TargetCounts {
  article: number;
  video: number;
  comment: number;
}

async function countLegacy(pool: Pool): Promise<LegacyCounts> {
  const [a, v, c] = await Promise.all([
    pool.query<{ n: string }>('SELECT count(*)::text AS n FROM articles'),
    pool.query<{ n: string }>('SELECT count(*)::text AS n FROM videos'),
    pool.query<{ n: string }>('SELECT count(*)::text AS n FROM comments'),
  ]);
  return {
    articles: Number(a.rows[0]?.n ?? 0),
    videos: Number(v.rows[0]?.n ?? 0),
    comments: Number(c.rows[0]?.n ?? 0),
  };
}

async function countTarget(pool: Pool): Promise<TargetCounts> {
  const { rows } = await pool.query<{ item_type: string; n: string }>(
    `SELECT item_type, count(*)::text AS n FROM raw_items GROUP BY item_type`,
  );
  const map = new Map(rows.map((r) => [r.item_type, Number(r.n)]));
  return {
    article: map.get('article') ?? 0,
    video: map.get('video') ?? 0,
    comment: map.get('comment') ?? 0,
  };
}

async function topKeywords(pool: Pool, limit = 10): Promise<Array<{ keyword: string; n: number }>> {
  const { rows } = await pool.query<{ keyword: string; n: string }>(
    `SELECT ks.keyword, count(ri.*)::text AS n
     FROM raw_items ri
     JOIN keyword_subscriptions ks ON ks.id = ri.subscription_id
     GROUP BY ks.keyword
     ORDER BY count(ri.*) DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({ keyword: r.keyword, n: Number(r.n) }));
}

export function percent(part: number, whole: number): string {
  if (whole === 0) return '—';
  return `${((part / whole) * 100).toFixed(1)}%`;
}

export function judge(legacy: number, target: number): 'ok' | 'warn' | 'fail' {
  if (legacy === 0) return 'ok';
  const ratio = target / legacy;
  if (ratio >= 0.95) return 'ok';
  if (ratio >= 0.9) return 'warn';
  return 'fail';
}

async function main() {
  const legacyUrl = process.env.LEGACY_DATABASE_URL;
  const targetUrl = process.env.DATABASE_URL;
  if (!legacyUrl || !targetUrl) {
    console.error('환경변수 LEGACY_DATABASE_URL, DATABASE_URL 필요');
    process.exit(1);
  }

  const src = new Pool({ connectionString: legacyUrl });
  const dst = new Pool({ connectionString: targetUrl });

  try {
    const [legacy, target, top] = await Promise.all([
      countLegacy(src),
      countTarget(dst),
      topKeywords(dst),
    ]);

    console.warn('=== 이관 검증 결과 ===');
    console.warn(
      `articles : legacy=${legacy.articles}  target=${target.article}  (${percent(target.article, legacy.articles)})  [${judge(legacy.articles, target.article)}]`,
    );
    console.warn(
      `videos   : legacy=${legacy.videos}  target=${target.video}  (${percent(target.video, legacy.videos)})  [${judge(legacy.videos, target.video)}]`,
    );
    console.warn(
      `comments : legacy=${legacy.comments}  target=${target.comment}  (${percent(target.comment, legacy.comments)})  [${judge(legacy.comments, target.comment)}]`,
    );

    console.warn('\n=== 상위 키워드(target) ===');
    for (const { keyword, n } of top) {
      console.warn(`  ${keyword.padEnd(30)} ${n}`);
    }

    const verdicts = [
      judge(legacy.articles, target.article),
      judge(legacy.videos, target.video),
      judge(legacy.comments, target.comment),
    ];

    if (verdicts.includes('fail')) {
      console.error('\n[FAIL] 10% 이상 누락된 item_type이 있습니다');
      process.exit(1);
    }
    if (verdicts.includes('warn')) {
      console.warn('\n[WARN] 5~10% 누락 — 유니크 중복 제거 가능성 확인 권장');
    } else {
      console.warn('\n[OK] 이관 건수 정상');
    }
  } finally {
    await src.end();
    await dst.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[verify] fatal:', err);
    process.exit(1);
  });
}
