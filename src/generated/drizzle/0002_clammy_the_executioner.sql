DROP INDEX "workflow_trigger_type_index";--> statement-breakpoint
DROP INDEX "workflow_run_temporal_workflow_id_index";--> statement-breakpoint
ALTER TABLE "workflow_run" ADD COLUMN "engine_workflow_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_run" ADD COLUMN "engine_run_id" text NOT NULL;--> statement-breakpoint
CREATE INDEX "workflow_run_engine_workflow_id_index" ON "workflow_run" USING btree ("engine_workflow_id");--> statement-breakpoint
ALTER TABLE "workflow" DROP COLUMN "trigger_type";--> statement-breakpoint
ALTER TABLE "workflow_run" DROP COLUMN "temporal_workflow_id";--> statement-breakpoint
ALTER TABLE "workflow_run" DROP COLUMN "temporal_run_id";