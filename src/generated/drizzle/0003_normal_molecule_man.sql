CREATE TABLE "mcp_server" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"command" text NOT NULL,
	"args" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"env" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
DROP INDEX IF EXISTS "workflow_trigger_type_index";--> statement-breakpoint
DROP INDEX IF EXISTS "workflow_run_temporal_workflow_id_index";--> statement-breakpoint
ALTER TABLE "workflow_run" ALTER COLUMN "workflow_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_run" ADD COLUMN "engine_workflow_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_run" ADD COLUMN "engine_run_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_server" ADD CONSTRAINT "mcp_server_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_server_id_index" ON "mcp_server" USING btree ("id");--> statement-breakpoint
CREATE INDEX "mcp_server_workspace_id_index" ON "mcp_server" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "mcp_server_name_index" ON "mcp_server" USING btree ("name");--> statement-breakpoint
CREATE INDEX "workflow_run_engine_workflow_id_index" ON "workflow_run" USING btree ("engine_workflow_id");--> statement-breakpoint
ALTER TABLE "workflow" DROP COLUMN "trigger_type";--> statement-breakpoint
ALTER TABLE "workflow_run" DROP COLUMN "temporal_workflow_id";--> statement-breakpoint
ALTER TABLE "workflow_run" DROP COLUMN "temporal_run_id";
