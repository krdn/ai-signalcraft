-- 데이터 정리 기반: CASCADE 삭제 정책 + 성능 인덱스 추가
-- collection_jobs 삭제 시 연관 데이터 자동 정리

-- 1. analysis_results: job 삭제 시 분석 결과 자동 삭제
ALTER TABLE "analysis_results"
  DROP CONSTRAINT IF EXISTS "analysis_results_job_id_collection_jobs_id_fk",
  ADD CONSTRAINT "analysis_results_job_id_collection_jobs_id_fk"
    FOREIGN KEY ("job_id") REFERENCES "collection_jobs"("id") ON DELETE CASCADE;

-- 2. analysis_reports: job 삭제 시 리포트 자동 삭제
ALTER TABLE "analysis_reports"
  DROP CONSTRAINT IF EXISTS "analysis_reports_job_id_collection_jobs_id_fk",
  ADD CONSTRAINT "analysis_reports_job_id_collection_jobs_id_fk"
    FOREIGN KEY ("job_id") REFERENCES "collection_jobs"("id") ON DELETE CASCADE;

-- 3. articles.job_id: job 삭제 시 레거시 FK를 NULL로 (N:M 조인 테이블이 CASCADE 처리)
ALTER TABLE "articles"
  DROP CONSTRAINT IF EXISTS "articles_job_id_collection_jobs_id_fk",
  ADD CONSTRAINT "articles_job_id_collection_jobs_id_fk"
    FOREIGN KEY ("job_id") REFERENCES "collection_jobs"("id") ON DELETE SET NULL;

-- 4. videos.job_id: 동일하게 SET NULL
ALTER TABLE "videos"
  DROP CONSTRAINT IF EXISTS "videos_job_id_collection_jobs_id_fk",
  ADD CONSTRAINT "videos_job_id_collection_jobs_id_fk"
    FOREIGN KEY ("job_id") REFERENCES "collection_jobs"("id") ON DELETE SET NULL;

-- 5. comments.job_id: 동일하게 SET NULL
ALTER TABLE "comments"
  DROP CONSTRAINT IF EXISTS "comments_job_id_collection_jobs_id_fk",
  ADD CONSTRAINT "comments_job_id_collection_jobs_id_fk"
    FOREIGN KEY ("job_id") REFERENCES "collection_jobs"("id") ON DELETE SET NULL;

-- 6. comments.article_id: article 삭제 시 댓글의 article_id를 NULL로
ALTER TABLE "comments"
  DROP CONSTRAINT IF EXISTS "comments_article_id_articles_id_fk",
  ADD CONSTRAINT "comments_article_id_articles_id_fk"
    FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE SET NULL;

-- 7. comments.video_id: video 삭제 시 댓글의 video_id를 NULL로
ALTER TABLE "comments"
  DROP CONSTRAINT IF EXISTS "comments_video_id_videos_id_fk",
  ADD CONSTRAINT "comments_video_id_videos_id_fk"
    FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE SET NULL;

-- 8. 성능 인덱스 추가
CREATE INDEX IF NOT EXISTS "collection_jobs_team_id_idx" ON "collection_jobs" ("team_id");
CREATE INDEX IF NOT EXISTS "collection_jobs_created_at_idx" ON "collection_jobs" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "collection_jobs_status_idx" ON "collection_jobs" ("status");
CREATE INDEX IF NOT EXISTS "comments_article_id_idx" ON "comments" ("article_id");
CREATE INDEX IF NOT EXISTS "comments_video_id_idx" ON "comments" ("video_id");
