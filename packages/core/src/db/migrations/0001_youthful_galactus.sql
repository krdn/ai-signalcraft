CREATE TABLE "article_jobs" (
	"article_id" integer NOT NULL,
	"job_id" integer NOT NULL,
	"collected_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment_jobs" (
	"comment_id" integer NOT NULL,
	"job_id" integer NOT NULL,
	"collected_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_jobs" (
	"video_id" integer NOT NULL,
	"job_id" integer NOT NULL,
	"collected_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concurrency_settings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "concurrency_settings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"provider_concurrency" jsonb NOT NULL,
	"api_concurrency" integer DEFAULT 5 NOT NULL,
	"article_batch_size" integer DEFAULT 10 NOT NULL,
	"comment_batch_size" integer DEFAULT 50 NOT NULL,
	"active_preset" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "articles" DROP CONSTRAINT "articles_job_id_collection_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "comments" DROP CONSTRAINT "comments_job_id_collection_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "comments" DROP CONSTRAINT "comments_article_id_articles_id_fk";
--> statement-breakpoint
ALTER TABLE "comments" DROP CONSTRAINT "comments_video_id_videos_id_fk";
--> statement-breakpoint
ALTER TABLE "videos" DROP CONSTRAINT "videos_job_id_collection_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "analysis_reports" DROP CONSTRAINT "analysis_reports_job_id_collection_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "analysis_results" DROP CONSTRAINT "analysis_results_job_id_collection_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "article_jobs" ADD CONSTRAINT "article_jobs_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_jobs" ADD CONSTRAINT "article_jobs_job_id_collection_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."collection_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_jobs" ADD CONSTRAINT "comment_jobs_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_jobs" ADD CONSTRAINT "comment_jobs_job_id_collection_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."collection_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_jobs" ADD CONSTRAINT "video_jobs_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_jobs" ADD CONSTRAINT "video_jobs_job_id_collection_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."collection_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "article_jobs_pk" ON "article_jobs" USING btree ("article_id","job_id");--> statement-breakpoint
CREATE INDEX "article_jobs_job_id_idx" ON "article_jobs" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "comment_jobs_pk" ON "comment_jobs" USING btree ("comment_id","job_id");--> statement-breakpoint
CREATE INDEX "comment_jobs_job_id_idx" ON "comment_jobs" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "video_jobs_pk" ON "video_jobs" USING btree ("video_id","job_id");--> statement-breakpoint
CREATE INDEX "video_jobs_job_id_idx" ON "video_jobs" USING btree ("job_id");--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_job_id_collection_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."collection_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_job_id_collection_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."collection_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_job_id_collection_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."collection_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_reports" ADD CONSTRAINT "analysis_reports_job_id_collection_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."collection_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_job_id_collection_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."collection_jobs"("id") ON DELETE cascade ON UPDATE no action;