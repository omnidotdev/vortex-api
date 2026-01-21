CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('personal', 'team');--> statement-breakpoint
CREATE TABLE "integration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"definition_id" text,
	"mcp_server_id" uuid,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
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
	"setup_steps" jsonb DEFAULT '[]'::jsonb,
	"docs_url" text,
	"supports_o_auth" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mcp_server" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
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
CREATE TABLE "plugin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"version" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"wasm_url" text NOT NULL,
	"wasm_hash" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"author_id" uuid,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_provider_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"avatar_url" text,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now(),
	CONSTRAINT "user_identityProviderId_unique" UNIQUE("identity_provider_id"),
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text,
	"type" "organization_type" DEFAULT 'team' NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"synced_at" timestamp(6) with time zone DEFAULT now(),
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now(),
	CONSTRAINT "user_organization_userId_organizationId_unique" UNIQUE("user_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "workflow" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"definition" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"cron_expression" text,
	"webhook_secret" text,
	"last_run_at" timestamp(6) with time zone DEFAULT now(),
	"last_run_status" text,
	"created_by" uuid,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workflow_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid,
	"engine_workflow_id" text NOT NULL,
	"engine_run_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp(6) with time zone DEFAULT now(),
	"completed_at" timestamp(6) with time zone DEFAULT now(),
	"input" jsonb,
	"output" jsonb,
	"error" text,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workflow_step_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_run_id" uuid NOT NULL,
	"step_id" text NOT NULL,
	"step_type" text NOT NULL,
	"step_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp(6) with time zone DEFAULT now(),
	"completed_at" timestamp(6) with time zone DEFAULT now(),
	"input" jsonb,
	"output" jsonb,
	"error" text,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "integration" ADD CONSTRAINT "integration_definition_id_integration_definition_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."integration_definition"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration" ADD CONSTRAINT "integration_mcp_server_id_mcp_server_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_server"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin" ADD CONSTRAINT "plugin_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organization" ADD CONSTRAINT "user_organization_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow" ADD CONSTRAINT "workflow_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_run" ADD CONSTRAINT "workflow_run_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_step_log" ADD CONSTRAINT "workflow_step_log_workflow_run_id_workflow_run_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integration_organization_id_idx" ON "integration" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "integration_definition_id_idx" ON "integration" USING btree ("definition_id");--> statement-breakpoint
CREATE INDEX "integration_mcp_server_id_idx" ON "integration" USING btree ("mcp_server_id");--> statement-breakpoint
CREATE INDEX "integration_type_idx" ON "integration" USING btree ("type");--> statement-breakpoint
CREATE INDEX "integration_is_enabled_idx" ON "integration" USING btree ("is_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_organization_integration_type" ON "integration" USING btree ("organization_id","type");--> statement-breakpoint
CREATE INDEX "integration_definition_category_idx" ON "integration_definition" USING btree ("category");--> statement-breakpoint
CREATE INDEX "integration_definition_is_featured_idx" ON "integration_definition" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "integration_definition_is_enabled_idx" ON "integration_definition" USING btree ("is_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_server_id_index" ON "mcp_server" USING btree ("id");--> statement-breakpoint
CREATE INDEX "mcp_server_organization_id_index" ON "mcp_server" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "mcp_server_type_index" ON "mcp_server" USING btree ("type");--> statement-breakpoint
CREATE INDEX "mcp_server_is_enabled_index" ON "mcp_server" USING btree ("is_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_organization_mcp_server_name" ON "mcp_server" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "plugin_id_index" ON "plugin" USING btree ("id");--> statement-breakpoint
CREATE INDEX "plugin_organization_id_index" ON "plugin" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "plugin_name_index" ON "plugin" USING btree ("name");--> statement-breakpoint
CREATE INDEX "plugin_is_enabled_index" ON "plugin" USING btree ("is_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_organization_plugin_version" ON "plugin" USING btree ("organization_id","name","version");--> statement-breakpoint
CREATE UNIQUE INDEX "user_id_index" ON "user" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_identity_provider_id_index" ON "user" USING btree ("identity_provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_index" ON "user" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "user_organization_id_index" ON "user_organization" USING btree ("id");--> statement-breakpoint
CREATE INDEX "user_organization_user_id_index" ON "user_organization" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_organization_organization_id_index" ON "user_organization" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_id_index" ON "workflow" USING btree ("id");--> statement-breakpoint
CREATE INDEX "workflow_organization_id_index" ON "workflow" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "workflow_is_active_index" ON "workflow" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "workflow_created_by_index" ON "workflow" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_run_id_index" ON "workflow_run" USING btree ("id");--> statement-breakpoint
CREATE INDEX "workflow_run_workflow_id_index" ON "workflow_run" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_run_status_index" ON "workflow_run" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_run_engine_workflow_id_index" ON "workflow_run" USING btree ("engine_workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_run_completed_at_index" ON "workflow_run" USING btree ("completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_step_log_id_index" ON "workflow_step_log" USING btree ("id");--> statement-breakpoint
CREATE INDEX "workflow_step_log_workflow_run_id_index" ON "workflow_step_log" USING btree ("workflow_run_id");--> statement-breakpoint
CREATE INDEX "workflow_step_log_step_id_index" ON "workflow_step_log" USING btree ("step_id");--> statement-breakpoint
CREATE INDEX "workflow_step_log_status_index" ON "workflow_step_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_step_log_completed_at_index" ON "workflow_step_log" USING btree ("completed_at");