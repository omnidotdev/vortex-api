CREATE TABLE "integration_definition" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon_url" text,
	"category" text DEFAULT 'custom' NOT NULL,
	"auth_type" text DEFAULT 'api_key' NOT NULL,
	"auth_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"mcp_package" text NOT NULL,
	"mcp_command" text DEFAULT 'npx' NOT NULL,
	"mcp_args" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"keep_alive" boolean DEFAULT false NOT NULL,
	"idle_timeout_ms" integer DEFAULT 300000 NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
DROP INDEX "integration_id_index";--> statement-breakpoint
DROP INDEX "integration_workspace_id_index";--> statement-breakpoint
DROP INDEX "integration_type_index";--> statement-breakpoint
DROP INDEX "integration_is_enabled_index";--> statement-breakpoint
ALTER TABLE "integration" ADD COLUMN "definition_id" text;--> statement-breakpoint
ALTER TABLE "integration" ADD COLUMN "mcp_server_id" uuid;--> statement-breakpoint
CREATE INDEX "integration_definition_category_idx" ON "integration_definition" USING btree ("category");--> statement-breakpoint
CREATE INDEX "integration_definition_is_featured_idx" ON "integration_definition" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "integration_definition_is_enabled_idx" ON "integration_definition" USING btree ("is_enabled");--> statement-breakpoint
ALTER TABLE "integration" ADD CONSTRAINT "integration_definition_id_integration_definition_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."integration_definition"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration" ADD CONSTRAINT "integration_mcp_server_id_mcp_server_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_server"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integration_workspace_id_idx" ON "integration" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "integration_definition_id_idx" ON "integration" USING btree ("definition_id");--> statement-breakpoint
CREATE INDEX "integration_mcp_server_id_idx" ON "integration" USING btree ("mcp_server_id");--> statement-breakpoint
CREATE INDEX "integration_type_idx" ON "integration" USING btree ("type");--> statement-breakpoint
CREATE INDEX "integration_is_enabled_idx" ON "integration" USING btree ("is_enabled");