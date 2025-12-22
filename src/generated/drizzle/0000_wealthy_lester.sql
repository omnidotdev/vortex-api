CREATE TYPE "public"."tier" AS ENUM('free', 'basic', 'team');--> statement-breakpoint
CREATE TYPE "public"."workspace_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
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
CREATE TABLE "workspace" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"tier" "tier" DEFAULT 'free' NOT NULL,
	"subscription_id" text,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now(),
	CONSTRAINT "workspace_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "workspace_user" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "workspace_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now(),
	CONSTRAINT "workspace_user_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "workspace_role" DEFAULT 'member' NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp(6) with time zone DEFAULT now(),
	"accepted_at" timestamp(6) with time zone DEFAULT now(),
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workflow" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"definition" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"trigger_type" text DEFAULT 'manual' NOT NULL,
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
	"workflow_id" uuid NOT NULL,
	"temporal_workflow_id" text NOT NULL,
	"temporal_run_id" text NOT NULL,
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
CREATE TABLE "plugin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
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
CREATE TABLE "integration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "workspace_user" ADD CONSTRAINT "workspace_user_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_user" ADD CONSTRAINT "workspace_user_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow" ADD CONSTRAINT "workflow_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow" ADD CONSTRAINT "workflow_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_run" ADD CONSTRAINT "workflow_run_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_step_log" ADD CONSTRAINT "workflow_step_log_workflow_run_id_workflow_run_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin" ADD CONSTRAINT "plugin_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin" ADD CONSTRAINT "plugin_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration" ADD CONSTRAINT "integration_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_id_index" ON "user" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_identity_provider_id_index" ON "user" USING btree ("identity_provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_index" ON "user" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_id_index" ON "workspace" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_slug_index" ON "workspace" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "workspace_tier_index" ON "workspace" USING btree ("tier");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_user_workspace_id_user_id_index" ON "workspace_user" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "workspace_user_user_id_index" ON "workspace_user" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_id_index" ON "invitation" USING btree ("id");--> statement-breakpoint
CREATE INDEX "invitation_workspace_id_index" ON "invitation" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "invitation_email_index" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_pending_invitation" ON "invitation" USING btree ("workspace_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_id_index" ON "workflow" USING btree ("id");--> statement-breakpoint
CREATE INDEX "workflow_workspace_id_index" ON "workflow" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workflow_is_active_index" ON "workflow" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "workflow_trigger_type_index" ON "workflow" USING btree ("trigger_type");--> statement-breakpoint
CREATE INDEX "workflow_created_by_index" ON "workflow" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_run_id_index" ON "workflow_run" USING btree ("id");--> statement-breakpoint
CREATE INDEX "workflow_run_workflow_id_index" ON "workflow_run" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_run_status_index" ON "workflow_run" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_run_temporal_workflow_id_index" ON "workflow_run" USING btree ("temporal_workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_run_completed_at_index" ON "workflow_run" USING btree ("completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_step_log_id_index" ON "workflow_step_log" USING btree ("id");--> statement-breakpoint
CREATE INDEX "workflow_step_log_workflow_run_id_index" ON "workflow_step_log" USING btree ("workflow_run_id");--> statement-breakpoint
CREATE INDEX "workflow_step_log_step_id_index" ON "workflow_step_log" USING btree ("step_id");--> statement-breakpoint
CREATE INDEX "workflow_step_log_status_index" ON "workflow_step_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_step_log_completed_at_index" ON "workflow_step_log" USING btree ("completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "plugin_id_index" ON "plugin" USING btree ("id");--> statement-breakpoint
CREATE INDEX "plugin_workspace_id_index" ON "plugin" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "plugin_name_index" ON "plugin" USING btree ("name");--> statement-breakpoint
CREATE INDEX "plugin_is_enabled_index" ON "plugin" USING btree ("is_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_workspace_plugin_version" ON "plugin" USING btree ("workspace_id","name","version");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_id_index" ON "integration" USING btree ("id");--> statement-breakpoint
CREATE INDEX "integration_workspace_id_index" ON "integration" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "integration_type_index" ON "integration" USING btree ("type");--> statement-breakpoint
CREATE INDEX "integration_is_enabled_index" ON "integration" USING btree ("is_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_workspace_integration_type" ON "integration" USING btree ("workspace_id","type");