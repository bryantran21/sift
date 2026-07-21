CREATE TABLE "job_sightings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"run_id" integer NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"company" text NOT NULL,
	"company_tier" integer NOT NULL,
	"title" text NOT NULL,
	"normalized_title" text NOT NULL,
	"locations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"work_mode" text DEFAULT 'unknown' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"description_hash" text DEFAULT '' NOT NULL,
	"apply_url" text NOT NULL,
	"ats" text NOT NULL,
	"ats_job_id" text NOT NULL,
	"source_slug" text NOT NULL,
	"posted_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"seen_count" integer DEFAULT 1 NOT NULL,
	"repost_count" integer DEFAULT 0 NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"seniority" text DEFAULT 'unknown' NOT NULL,
	"relevance_score" integer DEFAULT 0 NOT NULL,
	"filter_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"new_count" integer DEFAULT 0 NOT NULL,
	"still_live_count" integer DEFAULT 0 NOT NULL,
	"disappeared_count" integer DEFAULT 0 NOT NULL,
	"reappeared_count" integer DEFAULT 0 NOT NULL,
	"sources_total" integer DEFAULT 0 NOT NULL,
	"sources_ok" integer DEFAULT 0 NOT NULL,
	"sources_error" integer DEFAULT 0 NOT NULL,
	"source_status" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"company" text NOT NULL,
	"ats" text NOT NULL,
	"slug" text NOT NULL,
	"tier" integer NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_status" text DEFAULT 'never' NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	"etag" text,
	"last_modified" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"job_id" text NOT NULL,
	"saved" boolean DEFAULT false NOT NULL,
	"applied" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_sightings" ADD CONSTRAINT "job_sightings_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_sightings" ADD CONSTRAINT "job_sightings_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_state" ADD CONSTRAINT "user_state_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_sightings_job_idx" ON "job_sightings" USING btree ("job_id","seen_at");--> statement-breakpoint
CREATE INDEX "job_sightings_run_idx" ON "job_sightings" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "jobs_company_norm_title_idx" ON "jobs" USING btree ("company","normalized_title");--> statement-breakpoint
CREATE INDEX "jobs_removed_at_idx" ON "jobs" USING btree ("removed_at");--> statement-breakpoint
CREATE INDEX "jobs_posted_at_idx" ON "jobs" USING btree ("posted_at");--> statement-breakpoint
CREATE INDEX "jobs_first_seen_idx" ON "jobs" USING btree ("first_seen_at");--> statement-breakpoint
CREATE INDEX "jobs_relevance_idx" ON "jobs" USING btree ("relevance_score");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_ats_slug_uq" ON "sources" USING btree ("ats","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "user_state_device_job_uq" ON "user_state" USING btree ("device_id","job_id");