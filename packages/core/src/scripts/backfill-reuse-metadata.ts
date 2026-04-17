/**
 * TTL 증분 수집 기능 도입을 위한 백필 스크립트
 *
 * 1) articles.last_fetched_at / videos.last_fetched_at 이 NULL 인 row 를 collected_at 으로 초기화
 *    — 기존 데이터를 "가장 최근 수집된 상태" 로 간주하는 안전한 초기값
 * 2) article_keywords, video_keywords 를 collection_jobs.keyword + article_jobs / video_jobs 조인으로 재구성
 *    — 과거 수집된 기사/영상이 앞으로의 재사용 판정에서 매칭될 수 있도록
 *
 * 사용법:
 *   pnpm --filter @ai-signalcraft/core tsx src/scripts/backfill-reuse-metadata.ts
 *   DRY_RUN=1 ... (실행 쿼리만 출력)
 *
 * 운영 DB 를 공유하므로 먼저 개발 환경에서 실행해 결과를 확인한 뒤 운영 적용 권장.
 */
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { getDb } from '../db';

const DRY_RUN = process.env.DRY_RUN === '1';

async function main() {
  const db = getDb();

  const statements: Array<{ label: string; run: () => Promise<unknown> }> = [
    {
      label: 'articles.last_fetched_at 초기값 설정',
      run: () =>
        db.execute(
          sql`UPDATE articles SET last_fetched_at = collected_at WHERE last_fetched_at IS NULL`,
        ),
    },
    {
      label: 'videos.last_fetched_at 초기값 설정',
      run: () =>
        db.execute(
          sql`UPDATE videos SET last_fetched_at = collected_at WHERE last_fetched_at IS NULL`,
        ),
    },
    {
      label: 'article_keywords 백필 (정규화된 소문자 키워드)',
      run: () =>
        db.execute(sql`
          INSERT INTO article_keywords (article_id, keyword, first_seen_at)
          SELECT a.id,
                 LOWER(TRIM(cj.keyword)),
                 MIN(aj.collected_at)
          FROM articles a
          JOIN article_jobs aj ON aj.article_id = a.id
          JOIN collection_jobs cj ON cj.id = aj.job_id
          WHERE cj.keyword IS NOT NULL AND cj.keyword <> ''
          GROUP BY a.id, LOWER(TRIM(cj.keyword))
          ON CONFLICT DO NOTHING
        `),
    },
    {
      label: 'video_keywords 백필 (정규화된 소문자 키워드)',
      run: () =>
        db.execute(sql`
          INSERT INTO video_keywords (video_id, keyword, first_seen_at)
          SELECT v.id,
                 LOWER(TRIM(cj.keyword)),
                 MIN(vj.collected_at)
          FROM videos v
          JOIN video_jobs vj ON vj.video_id = v.id
          JOIN collection_jobs cj ON cj.id = vj.job_id
          WHERE cj.keyword IS NOT NULL AND cj.keyword <> ''
          GROUP BY v.id, LOWER(TRIM(cj.keyword))
          ON CONFLICT DO NOTHING
        `),
    },
  ];

  for (const stmt of statements) {
    console.log(`\n▶ ${stmt.label}${DRY_RUN ? ' (DRY_RUN)' : ''}`);
    if (DRY_RUN) continue;
    const started = Date.now();
    const result: any = await stmt.run();
    const ms = Date.now() - started;
    const rowCount = result?.rowCount ?? result?.rows?.length ?? '?';
    console.log(`  ✔ ${rowCount} rows affected (${ms}ms)`);
  }

  console.log('\n백필 완료. last_fetched_at 과 article/video_keywords 가 준비되었습니다.');
}

main().catch((err) => {
  console.error('백필 중 오류:', err);
  process.exit(1);
});
