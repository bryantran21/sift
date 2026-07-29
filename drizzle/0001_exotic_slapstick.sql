ALTER TABLE "jobs" ADD COLUMN "country" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
CREATE INDEX "jobs_category_idx" ON "jobs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "jobs_country_idx" ON "jobs" USING btree ("country");