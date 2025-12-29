CREATE TABLE "test_health" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" uuid NOT NULL,
	"total_runs" integer DEFAULT 0 NOT NULL,
	"passed_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"flaky_count" integer DEFAULT 0 NOT NULL,
	"pass_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"flakiness_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"avg_duration_ms" integer DEFAULT 0 NOT NULL,
	"health_score" integer DEFAULT 100 NOT NULL,
	"trend" varchar(20) DEFAULT 'stable' NOT NULL,
	"consecutive_passes" integer DEFAULT 0 NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_status" varchar(50),
	"last_run_at" timestamp with time zone,
	"last_passed_at" timestamp with time zone,
	"last_failed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "test_health_test_id_unique" UNIQUE("test_id")
);
--> statement-breakpoint
CREATE TABLE "test_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" uuid NOT NULL,
	"test_run_id" uuid NOT NULL,
	"status" varchar(50) NOT NULL,
	"expected_status" varchar(50) NOT NULL,
	"duration_ms" integer NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"worker_index" integer,
	"parallel_index" integer,
	"error_message" text,
	"error_stack" text,
	"error_snippet" text,
	"outcome" varchar(50) NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"annotations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skipped_by_dashboard" boolean DEFAULT false NOT NULL,
	"base_url" varchar(1024),
	"started_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" varchar(255) NOT NULL,
	"branch" varchar(255),
	"commit_sha" varchar(40),
	"commit_message" text,
	"ci_job_url" varchar(1024),
	"base_url" varchar(1024),
	"playwright_version" varchar(50),
	"total_workers" integer,
	"shard_current" integer,
	"shard_total" integer,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"total_tests" integer DEFAULT 0 NOT NULL,
	"passed_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"flaky_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(50) DEFAULT 'running' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "test_runs_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE TABLE "tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playwright_test_id" varchar(255) NOT NULL,
	"repository" varchar(255) NOT NULL,
	"file_path" varchar(1024) NOT NULL,
	"test_title" varchar(1024) NOT NULL,
	"project_name" varchar(255) NOT NULL,
	"tags" text[] DEFAULT '{}',
	"location_line" integer,
	"location_column" integer,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"disabled_at" timestamp with time zone,
	"disabled_reason" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_reason" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "test_health" ADD CONSTRAINT "test_health_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_test_run_id_test_runs_id_fk" FOREIGN KEY ("test_run_id") REFERENCES "public"."test_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_test_health_health_score" ON "test_health" USING btree ("health_score");--> statement-breakpoint
CREATE INDEX "idx_test_health_pass_rate" ON "test_health" USING btree ("pass_rate");--> statement-breakpoint
CREATE INDEX "idx_test_results_test_id" ON "test_results" USING btree ("test_id");--> statement-breakpoint
CREATE INDEX "idx_test_results_test_run_id" ON "test_results" USING btree ("test_run_id");--> statement-breakpoint
CREATE INDEX "idx_test_results_status" ON "test_results" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_test_results_outcome" ON "test_results" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "idx_test_results_started_at" ON "test_results" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_test_runs_started_at" ON "test_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_test_runs_status" ON "test_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_test_runs_branch" ON "test_runs" USING btree ("branch");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_test" ON "tests" USING btree ("repository","file_path","test_title","project_name");--> statement-breakpoint
CREATE INDEX "idx_tests_playwright_id" ON "tests" USING btree ("playwright_test_id");--> statement-breakpoint
CREATE INDEX "idx_tests_enabled" ON "tests" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "idx_tests_deleted" ON "tests" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_tests_project" ON "tests" USING btree ("project_name");--> statement-breakpoint
CREATE INDEX "idx_tests_repository" ON "tests" USING btree ("repository");