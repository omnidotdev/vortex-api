CREATE TABLE "plugin_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"workflow_id" uuid,
	"run_id" uuid,
	"function_name" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"success" boolean NOT NULL,
	"executed_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "plugin_usage" ADD CONSTRAINT "plugin_usage_plugin_id_plugin_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plugin_usage_plugin_id_index" ON "plugin_usage" USING btree ("plugin_id");--> statement-breakpoint
CREATE INDEX "plugin_usage_organization_id_index" ON "plugin_usage" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "plugin_usage_executed_at_index" ON "plugin_usage" USING btree ("executed_at");