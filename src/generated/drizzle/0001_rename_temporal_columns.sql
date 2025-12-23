-- Rename temporal columns to engine-agnostic names
ALTER TABLE "workflow_run" RENAME COLUMN "temporal_workflow_id" TO "engine_workflow_id";--> statement-breakpoint
ALTER TABLE "workflow_run" RENAME COLUMN "temporal_run_id" TO "engine_run_id";--> statement-breakpoint
DROP INDEX IF EXISTS "workflow_run_temporal_workflow_id_index";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_run_engine_workflow_id_index" ON "workflow_run" USING btree ("engine_workflow_id");--> statement-breakpoint
-- Remove triggerType column from workflow table (trigger is defined in workflow definition)
DROP INDEX IF EXISTS "workflow_trigger_type_index";--> statement-breakpoint
ALTER TABLE "workflow" DROP COLUMN IF EXISTS "trigger_type";
