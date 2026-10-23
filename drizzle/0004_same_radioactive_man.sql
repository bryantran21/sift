ALTER TABLE "sources" ADD COLUMN "industry" text DEFAULT 'tech' NOT NULL;--> statement-breakpoint
CREATE INDEX "sources_industry_idx" ON "sources" USING btree ("industry");