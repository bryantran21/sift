ALTER TABLE "jobs" ADD COLUMN "title_base" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "salary_min" double precision;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "salary_max" double precision;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "salary_period" text;--> statement-breakpoint
CREATE INDEX "jobs_company_title_base_idx" ON "jobs" USING btree ("company","title_base");