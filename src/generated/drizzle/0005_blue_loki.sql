CREATE TABLE "workflow_executor_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"slug" text NOT NULL,
	"type" text NOT NULL,
	"config" text NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_executor_config_id_index" ON "workflow_executor_config" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_executor_config_org_slug_idx" ON "workflow_executor_config" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "workflow_executor_config_organization_id_index" ON "workflow_executor_config" USING btree ("organization_id");