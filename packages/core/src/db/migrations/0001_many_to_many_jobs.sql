-- N:M 조인 테이블: 기사/영상/댓글이 여러 수집 작업에서 참조 가능
-- articles.job_id 덮어쓰기 문제 해결

-- 1. 조인 테이블 생성
CREATE TABLE IF NOT EXISTS "article_jobs" (
  "article_id" integer NOT NULL REFERENCES "articles"("id") ON DELETE CASCADE,
  "job_id" integer NOT NULL REFERENCES "collection_jobs"("id") ON DELETE CASCADE,
  "collected_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "video_jobs" (
  "video_id" integer NOT NULL REFERENCES "videos"("id") ON DELETE CASCADE,
  "job_id" integer NOT NULL REFERENCES "collection_jobs"("id") ON DELETE CASCADE,
  "collected_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comment_jobs" (
  "comment_id" integer NOT NULL REFERENCES "comments"("id") ON DELETE CASCADE,
  "job_id" integer NOT NULL REFERENCES "collection_jobs"("id") ON DELETE CASCADE,
  "collected_at" timestamp DEFAULT now() NOT NULL
);

-- 2. Unique 인덱스 (복합 PK 역할)
CREATE UNIQUE INDEX IF NOT EXISTS "article_jobs_pk" ON "article_jobs" ("article_id", "job_id");
CREATE UNIQUE INDEX IF NOT EXISTS "video_jobs_pk" ON "video_jobs" ("video_id", "job_id");
CREATE UNIQUE INDEX IF NOT EXISTS "comment_jobs_pk" ON "comment_jobs" ("comment_id", "job_id");

-- 3. job_id 인덱스 (조회 성능)
CREATE INDEX IF NOT EXISTS "article_jobs_job_id_idx" ON "article_jobs" ("job_id");
CREATE INDEX IF NOT EXISTS "video_jobs_job_id_idx" ON "video_jobs" ("job_id");
CREATE INDEX IF NOT EXISTS "comment_jobs_job_id_idx" ON "comment_jobs" ("job_id");

-- 4. 기존 데이터 이전: articles.job_id -> article_jobs
INSERT INTO "article_jobs" ("article_id", "job_id", "collected_at")
SELECT "id", "job_id", "collected_at" FROM "articles" WHERE "job_id" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "video_jobs" ("video_id", "job_id", "collected_at")
SELECT "id", "job_id", "collected_at" FROM "videos" WHERE "job_id" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "comment_jobs" ("comment_id", "job_id", "collected_at")
SELECT "id", "job_id", "collected_at" FROM "comments" WHERE "job_id" IS NOT NULL
ON CONFLICT DO NOTHING;

-- 참고: articles/videos/comments의 job_id 컬럼은 이번에 DROP하지 않음 (하위 호환)
-- 충분한 검증 후 별도 마이그레이션으로 제거 예정
