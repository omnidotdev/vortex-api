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
CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
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
ALTER TABLE "plugin" ADD COLUMN "edge_capable" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "workflow" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "approval_request" ADD CONSTRAINT "approval_request_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_version" ADD CONSTRAINT "workflow_version_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_version" ADD CONSTRAINT "workflow_version_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approval_request_org_idx" ON "approval_request" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "approval_request_run_step_idx" ON "approval_request" USING btree ("run_id","step_id");--> statement-breakpoint
CREATE INDEX "approval_request_status_idx" ON "approval_request" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "fn_id_index" ON "fn" USING btree ("id");--> statement-breakpoint
CREATE INDEX "fn_organization_id_index" ON "fn" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "fn_name_index" ON "fn" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_organization_fn_name" ON "fn" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "outbox_pending_idx" ON "outbox" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "outbox_created_at_index" ON "outbox" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rivet_graph_id_index" ON "rivet_graph" USING btree ("id");--> statement-breakpoint
CREATE INDEX "rivet_graph_organization_id_index" ON "rivet_graph" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_organization_rivet_graph_name" ON "rivet_graph" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_version_id_index" ON "workflow_version" USING btree ("id");--> statement-breakpoint
CREATE INDEX "workflow_version_workflow_id_index" ON "workflow_version" USING btree ("workflow_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_version_workflow_id_version_index" ON "workflow_version" USING btree ("workflow_id","version");