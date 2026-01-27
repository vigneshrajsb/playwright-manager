CREATE TABLE "error_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" uuid NOT NULL,
	"signature_hash" varchar(64) NOT NULL,
	"error_message" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"passed_after_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"version" integer NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "verdict_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_run_id" uuid NOT NULL,
	"test_id" uuid NOT NULL,
	"verdict" varchar(20) NOT NULL,
	"confidence" integer NOT NULL,
	"llm_used" boolean DEFAULT false NOT NULL,
	"feedback" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "error_signatures" ADD CONSTRAINT "error_signatures_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verdict_feedback" ADD CONSTRAINT "verdict_feedback_test_run_id_test_runs_id_fk" FOREIGN KEY ("test_run_id") REFERENCES "public"."test_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verdict_feedback" ADD CONSTRAINT "verdict_feedback_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_error_sig_test_id" ON "error_signatures" USING btree ("test_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_error_sig_unique" ON "error_signatures" USING btree ("test_id","signature_hash");--> statement-breakpoint
CREATE INDEX "idx_prompt_settings_is_active" ON "prompt_settings" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_prompt_settings_version" ON "prompt_settings" USING btree ("version");--> statement-breakpoint
CREATE INDEX "idx_verdict_feedback_test_run" ON "verdict_feedback" USING btree ("test_run_id");--> statement-breakpoint
CREATE INDEX "idx_verdict_feedback_test" ON "verdict_feedback" USING btree ("test_id");