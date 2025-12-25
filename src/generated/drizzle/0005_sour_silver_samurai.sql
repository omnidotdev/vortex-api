CREATE TABLE "mcp_server" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'custom' NOT NULL,
	"command" text NOT NULL,
	"args" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"env" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cwd" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "mcp_server" ADD CONSTRAINT "mcp_server_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_server_id_index" ON "mcp_server" USING btree ("id");--> statement-breakpoint
CREATE INDEX "mcp_server_workspace_id_index" ON "mcp_server" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "mcp_server_type_index" ON "mcp_server" USING btree ("type");--> statement-breakpoint
CREATE INDEX "mcp_server_is_enabled_index" ON "mcp_server" USING btree ("is_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_workspace_mcp_server_name" ON "mcp_server" USING btree ("workspace_id","name");