CREATE TABLE "fix_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"repo_full_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"github_run_id" bigint,
	"run_url" text,
	"pr_url" text,
	"error" text,
	"brief_fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "repo_full_name" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "repo_id" bigint;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "repo_private" boolean;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "github_installation_id" bigint;--> statement-breakpoint
ALTER TABLE "fix_runs" ADD CONSTRAINT "fix_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fix_runs" ADD CONSTRAINT "fix_runs_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fix_runs_issue_id_idx" ON "fix_runs" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "fix_runs_project_created_idx" ON "fix_runs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "fix_runs_status_idx" ON "fix_runs" USING btree ("status");