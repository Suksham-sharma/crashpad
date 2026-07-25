ALTER TABLE "events" ADD COLUMN "signal" jsonb;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "kind" text DEFAULT 'error' NOT NULL;--> statement-breakpoint
CREATE INDEX "issues_project_kind_idx" ON "issues" USING btree ("project_id","kind");