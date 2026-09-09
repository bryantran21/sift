CREATE TABLE "application_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"company" text NOT NULL,
	"type" text NOT NULL,
	"event_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"device_id" text PRIMARY KEY NOT NULL,
	"resume_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dream_companies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resume_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "application_events_device_company_idx" ON "application_events" USING btree ("device_id","company");