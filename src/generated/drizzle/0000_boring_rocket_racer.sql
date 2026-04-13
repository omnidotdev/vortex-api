CREATE TABLE "approval_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"workflow_id" uuid NOT NULL,
	"run_id" text NOT NULL,
	"step_id" text NOT NULL,
	"gate_type" text NOT NULL,
	"title" text,
	"approvers" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" text,
	"reason" text,
	"signal_name" text,
	"signal_data" jsonb,
	"timeout_ms" text,
	"timeout_action" text DEFAULT 'reject',
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dead_letter_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"event_source" text NOT NULL,
	"event_data" jsonb NOT NULL,
	"error" text NOT NULL,
	"error_code" text NOT NULL,
	"routing_rule_id" uuid NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"organization_id" text NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_suppression" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"reason" text NOT NULL,
	"source" text,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"specversion" text DEFAULT '1.0',
	"type" text NOT NULL,
	"source" text NOT NULL,
	"subject" text,
	"organization_id" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"correlation_id" text,
	"schema_id" text,
	"dataschema" text,
	"timestamp" text NOT NULL,
	"recorded_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_routing_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"workflow_id" uuid NOT NULL,
	"source_pattern" text,
	"type_pattern" text NOT NULL,
	"condition" text,
	"cel_condition" text,
	"batch" jsonb,
	"transform" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_schema" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL,
	"description" text,
	"payload_schema" jsonb,
	"enforcement" text DEFAULT 'warn' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"compatibility_mode" text DEFAULT 'backward' NOT NULL,
	"previous_version_id" uuid,
	"migration_transform" text,
	"organization_id" text NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_pattern" text,
	"type_pattern" text NOT NULL,
	"target_url" text NOT NULL,
	"hmac_secret" text NOT NULL,
	"signature_header" text DEFAULT 'x-vortex-signature' NOT NULL,
	"transform" text,
	"payload_mode" text DEFAULT 'data' NOT NULL,
	"max_retries" integer DEFAULT 5 NOT NULL,
	"initial_backoff_ms" integer DEFAULT 1000 NOT NULL,
	"backoff_multiplier" integer DEFAULT 2 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fn" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"runtime" text NOT NULL,
	"source" text,
	"wasm_module_url" text,
	"executor" text DEFAULT 'local' NOT NULL,
	"limits" jsonb,
	"metadata" jsonb,
	"invocation_count" integer DEFAULT 0 NOT NULL,
	"last_invoked_at" timestamp(6) with time zone DEFAULT now(),
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"definition_id" text,
	"mcp_server_id" uuid,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"auth_method" text DEFAULT 'manual' NOT NULL,
	"oauth_status" text,
	"oauth_connected_at" timestamp(6) with time zone,
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
	"transport" text DEFAULT 'stdio',
	"command" text,
	"args" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"env" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cwd" text,
	"url" text,
	"headers" jsonb,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "oauth_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" text NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"definition_id" text NOT NULL,
	"code_verifier" text,
	"code_challenge" text,
	"redirect_uri" text NOT NULL,
	"scopes" text[] NOT NULL,
	"return_url" text,
	"expires_at" timestamp(6) with time zone NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "oauth_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_type" text DEFAULT 'Bearer' NOT NULL,
	"scope" text NOT NULL,
	"expires_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
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
	"edge_capable" boolean DEFAULT false,
	"config" jsonb DEFAULT '{}'::jsonb,
	"author_id" uuid,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plugin_marketplace" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"author" text NOT NULL,
	"version" text NOT NULL,
	"wasm_url" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"downloads" integer DEFAULT 0 NOT NULL,
	"rating" integer DEFAULT 0,
	"is_verified" boolean DEFAULT false NOT NULL,
	"tags" text[],
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plugin_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"workflow_id" uuid,
	"run_id" uuid,
	"function_name" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"success" boolean NOT NULL,
	"invocation_source" text DEFAULT 'workflow' NOT NULL,
	"executed_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rivet_graph" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"graph_json" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "saga_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_run_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp(6) with time zone DEFAULT now(),
	"completed_at" timestamp(6) with time zone DEFAULT now(),
	"error" text,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "saga_step_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"saga_run_id" uuid NOT NULL,
	"step_name" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"execute_status" text DEFAULT 'pending' NOT NULL,
	"compensate_status" text DEFAULT 'pending' NOT NULL,
	"execute_input" jsonb DEFAULT '{}'::jsonb,
	"execute_output" jsonb,
	"compensate_input" jsonb,
	"compensate_output" jsonb,
	"error" text,
	"started_at" timestamp(6) with time zone DEFAULT now(),
	"completed_at" timestamp(6) with time zone DEFAULT now(),
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_delivery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"organization_id" text NOT NULL,
	"payload" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"http_status" integer,
	"error" text,
	"next_retry_at" timestamp(6) with time zone DEFAULT now(),
	"completed_at" timestamp(6) with time zone DEFAULT now(),
	"created_at" timestamp(6) with time zone DEFAULT now()
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
	"billing_account_id" text,
	"type" text DEFAULT 'team' NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"synced_at" timestamp(6) with time zone DEFAULT now(),
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now(),
	CONSTRAINT "user_organization_userId_organizationId_unique" UNIQUE("user_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "warden_sync_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation" text NOT NULL,
	"tuples" jsonb NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 10 NOT NULL,
	"next_retry_at" timestamp with time zone NOT NULL,
	"last_error" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workflow" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"definition" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"executor" text DEFAULT 'hatchet' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"cron_expression" text,
	"webhook_secret" text,
	"last_run_at" timestamp(6) with time zone DEFAULT now(),
	"last_run_status" text,
	"created_by" uuid,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
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
CREATE TABLE "workflow_permission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"permission" text NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workflow_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid,
	"engine_workflow_id" text NOT NULL,
	"engine_run_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp(6) with time zone DEFAULT now(),
	"completed_at" timestamp(6) with time zone,
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
CREATE TABLE "workflow_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"long_description" text,
	"category" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"icon_url" text,
	"definition" jsonb NOT NULL,
	"required_integrations" text[] DEFAULT '{}' NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" text DEFAULT '0',
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workflow_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"definition" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"change_note" text
);
--> statement-breakpoint
ALTER TABLE "approval_request" ADD CONSTRAINT "approval_request_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dead_letter_event" ADD CONSTRAINT "dead_letter_event_routing_rule_id_event_routing_rule_id_fk" FOREIGN KEY ("routing_rule_id") REFERENCES "public"."event_routing_rule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_routing_rule" ADD CONSTRAINT "event_routing_rule_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration" ADD CONSTRAINT "integration_definition_id_integration_definition_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."integration_definition"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration" ADD CONSTRAINT "integration_mcp_server_id_mcp_server_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_server"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_token" ADD CONSTRAINT "oauth_token_integration_id_integration_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integration"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin" ADD CONSTRAINT "plugin_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_usage" ADD CONSTRAINT "plugin_usage_plugin_id_plugin_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saga_run" ADD CONSTRAINT "saga_run_workflow_run_id_workflow_run_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saga_step_log" ADD CONSTRAINT "saga_step_log_saga_run_id_saga_run_id_fk" FOREIGN KEY ("saga_run_id") REFERENCES "public"."saga_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_delivery" ADD CONSTRAINT "subscription_delivery_subscription_id_event_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."event_subscription"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organization" ADD CONSTRAINT "user_organization_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow" ADD CONSTRAINT "workflow_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_permission" ADD CONSTRAINT "workflow_permission_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_permission" ADD CONSTRAINT "workflow_permission_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_permission" ADD CONSTRAINT "workflow_permission_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_run" ADD CONSTRAINT "workflow_run_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_step_log" ADD CONSTRAINT "workflow_step_log_workflow_run_id_workflow_run_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_version" ADD CONSTRAINT "workflow_version_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_version" ADD CONSTRAINT "workflow_version_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approval_request_org_idx" ON "approval_request" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "approval_request_run_step_idx" ON "approval_request" USING btree ("run_id","step_id");--> statement-breakpoint
CREATE INDEX "approval_request_status_idx" ON "approval_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dead_letter_event_org_idx" ON "dead_letter_event" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "dead_letter_event_resolved_idx" ON "dead_letter_event" USING btree ("resolved_at");--> statement-breakpoint
CREATE INDEX "dead_letter_event_type_idx" ON "dead_letter_event" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "email_suppression_id_index" ON "email_suppression" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_suppression_email_idx" ON "email_suppression" USING btree ("email");--> statement-breakpoint
CREATE INDEX "event_log_organization_id_index" ON "event_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_log_type_index" ON "event_log" USING btree ("type");--> statement-breakpoint
CREATE INDEX "event_log_correlation_id_index" ON "event_log" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "event_log_recorded_at_index" ON "event_log" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "event_log_source_index" ON "event_log" USING btree ("source");--> statement-breakpoint
CREATE INDEX "event_routing_rule_org_idx" ON "event_routing_rule" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_routing_rule_workflow_idx" ON "event_routing_rule" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "event_routing_rule_enabled_idx" ON "event_routing_rule" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "event_routing_rule_lookup_idx" ON "event_routing_rule" USING btree ("organization_id","enabled","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "event_schema_name_version_org_idx" ON "event_schema" USING btree ("name","version","organization_id");--> statement-breakpoint
CREATE INDEX "event_schema_name_idx" ON "event_schema" USING btree ("name");--> statement-breakpoint
CREATE INDEX "event_schema_org_idx" ON "event_schema" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_subscription_org_idx" ON "event_subscription" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_subscription_org_enabled_idx" ON "event_subscription" USING btree ("organization_id","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "event_subscription_org_name_uniq" ON "event_subscription" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "fn_id_index" ON "fn" USING btree ("id");--> statement-breakpoint
CREATE INDEX "fn_organization_id_index" ON "fn" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "fn_name_index" ON "fn" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_organization_fn_name" ON "fn" USING btree ("organization_id","name");--> statement-breakpoint
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
CREATE UNIQUE INDEX "oauth_state_state_idx" ON "oauth_state" USING btree ("state");--> statement-breakpoint
CREATE INDEX "oauth_state_organization_id_idx" ON "oauth_state" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "oauth_state_provider_idx" ON "oauth_state" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "oauth_state_expires_at_idx" ON "oauth_state" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "oauth_token_integration_id_idx" ON "oauth_token" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX "oauth_token_organization_id_idx" ON "oauth_token" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "oauth_token_provider_idx" ON "oauth_token" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "oauth_token_expires_at_idx" ON "oauth_token" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "outbox_pending_idx" ON "outbox" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "outbox_created_at_index" ON "outbox" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "plugin_id_index" ON "plugin" USING btree ("id");--> statement-breakpoint
CREATE INDEX "plugin_organization_id_index" ON "plugin" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "plugin_name_index" ON "plugin" USING btree ("name");--> statement-breakpoint
CREATE INDEX "plugin_is_enabled_index" ON "plugin" USING btree ("is_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_organization_plugin_version" ON "plugin" USING btree ("organization_id","name","version");--> statement-breakpoint
CREATE INDEX "plugin_marketplace_name_index" ON "plugin_marketplace" USING btree ("name");--> statement-breakpoint
CREATE INDEX "plugin_marketplace_author_index" ON "plugin_marketplace" USING btree ("author");--> statement-breakpoint
CREATE INDEX "plugin_marketplace_is_verified_index" ON "plugin_marketplace" USING btree ("is_verified");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_marketplace_name_version" ON "plugin_marketplace" USING btree ("name","version");--> statement-breakpoint
CREATE INDEX "plugin_usage_plugin_id_index" ON "plugin_usage" USING btree ("plugin_id");--> statement-breakpoint
CREATE INDEX "plugin_usage_organization_id_index" ON "plugin_usage" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "plugin_usage_executed_at_index" ON "plugin_usage" USING btree ("executed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rivet_graph_id_index" ON "rivet_graph" USING btree ("id");--> statement-breakpoint
CREATE INDEX "rivet_graph_organization_id_index" ON "rivet_graph" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_organization_rivet_graph_name" ON "rivet_graph" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "saga_run_id_index" ON "saga_run" USING btree ("id");--> statement-breakpoint
CREATE INDEX "saga_run_workflow_run_id_index" ON "saga_run" USING btree ("workflow_run_id");--> statement-breakpoint
CREATE INDEX "saga_run_organization_id_index" ON "saga_run" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "saga_run_status_index" ON "saga_run" USING btree ("status");--> statement-breakpoint
CREATE INDEX "saga_run_completed_at_index" ON "saga_run" USING btree ("completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "saga_step_log_id_index" ON "saga_step_log" USING btree ("id");--> statement-breakpoint
CREATE INDEX "saga_step_log_saga_run_id_index" ON "saga_step_log" USING btree ("saga_run_id");--> statement-breakpoint
CREATE INDEX "saga_step_log_idempotency_key_index" ON "saga_step_log" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "saga_step_log_execute_status_index" ON "saga_step_log" USING btree ("execute_status");--> statement-breakpoint
CREATE INDEX "saga_step_log_compensate_status_index" ON "saga_step_log" USING btree ("compensate_status");--> statement-breakpoint
CREATE INDEX "subscription_delivery_sub_idx" ON "subscription_delivery" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscription_delivery_status_retry_idx" ON "subscription_delivery" USING btree ("status","next_retry_at");--> statement-breakpoint
CREATE INDEX "subscription_delivery_org_idx" ON "subscription_delivery" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_id_index" ON "user" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_identity_provider_id_index" ON "user" USING btree ("identity_provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_index" ON "user" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "user_organization_id_index" ON "user_organization" USING btree ("id");--> statement-breakpoint
CREATE INDEX "user_organization_user_id_index" ON "user_organization" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_organization_organization_id_index" ON "user_organization" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "warden_sync_queue_status_retry_idx" ON "warden_sync_queue" USING btree ("status","next_retry_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_id_index" ON "workflow" USING btree ("id");--> statement-breakpoint
CREATE INDEX "workflow_organization_id_index" ON "workflow" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "workflow_is_active_index" ON "workflow" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "workflow_created_by_index" ON "workflow" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "workflow_webhook_secret_index" ON "workflow" USING btree ("webhook_secret");--> statement-breakpoint
CREATE INDEX "workflow_executor_index" ON "workflow" USING btree ("executor");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_executor_config_id_index" ON "workflow_executor_config" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_executor_config_org_slug_idx" ON "workflow_executor_config" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "workflow_executor_config_organization_id_index" ON "workflow_executor_config" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_permission_id_index" ON "workflow_permission" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_permission_workflow_id_user_id_index" ON "workflow_permission" USING btree ("workflow_id","user_id");--> statement-breakpoint
CREATE INDEX "workflow_permission_workflow_id_index" ON "workflow_permission" USING btree ("workflow_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_run_id_index" ON "workflow_run" USING btree ("id");--> statement-breakpoint
CREATE INDEX "workflow_run_workflow_id_index" ON "workflow_run" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_run_status_index" ON "workflow_run" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_run_engine_workflow_id_index" ON "workflow_run" USING btree ("engine_workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_run_completed_at_index" ON "workflow_run" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "workflow_run_created_at_index" ON "workflow_run" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_step_log_id_index" ON "workflow_step_log" USING btree ("id");--> statement-breakpoint
CREATE INDEX "workflow_step_log_workflow_run_id_index" ON "workflow_step_log" USING btree ("workflow_run_id");--> statement-breakpoint
CREATE INDEX "workflow_step_log_step_id_index" ON "workflow_step_log" USING btree ("step_id");--> statement-breakpoint
CREATE INDEX "workflow_step_log_status_index" ON "workflow_step_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_step_log_completed_at_index" ON "workflow_step_log" USING btree ("completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_template_id_index" ON "workflow_template" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_template_slug_idx" ON "workflow_template" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "workflow_template_category_idx" ON "workflow_template" USING btree ("category");--> statement-breakpoint
CREATE INDEX "workflow_template_is_public_idx" ON "workflow_template" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "workflow_template_is_featured_idx" ON "workflow_template" USING btree ("is_featured");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_version_id_index" ON "workflow_version" USING btree ("id");--> statement-breakpoint
CREATE INDEX "workflow_version_workflow_id_index" ON "workflow_version" USING btree ("workflow_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_version_workflow_id_version_index" ON "workflow_version" USING btree ("workflow_id","version");