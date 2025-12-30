DROP INDEX "idx_tests_enabled";--> statement-breakpoint
ALTER TABLE "skip_rules" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "test_health" ADD COLUMN "recent_pass_rate" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "test_health" ADD COLUMN "recent_flakiness_rate" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "test_health" ADD COLUMN "health_divergence" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "tests" DROP COLUMN "is_enabled";--> statement-breakpoint
ALTER TABLE "tests" DROP COLUMN "disabled_at";--> statement-breakpoint
ALTER TABLE "tests" DROP COLUMN "disabled_reason";