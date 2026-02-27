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
ALTER TABLE "saga_run" ADD CONSTRAINT "saga_run_workflow_run_id_workflow_run_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saga_step_log" ADD CONSTRAINT "saga_step_log_saga_run_id_saga_run_id_fk" FOREIGN KEY ("saga_run_id") REFERENCES "public"."saga_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "saga_run_id_index" ON "saga_run" USING btree ("id");--> statement-breakpoint
CREATE INDEX "saga_run_workflow_run_id_index" ON "saga_run" USING btree ("workflow_run_id");--> statement-breakpoint
CREATE INDEX "saga_run_organization_id_index" ON "saga_run" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "saga_run_status_index" ON "saga_run" USING btree ("status");--> statement-breakpoint
CREATE INDEX "saga_run_completed_at_index" ON "saga_run" USING btree ("completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "saga_step_log_id_index" ON "saga_step_log" USING btree ("id");--> statement-breakpoint
CREATE INDEX "saga_step_log_saga_run_id_index" ON "saga_step_log" USING btree ("saga_run_id");--> statement-breakpoint
CREATE INDEX "saga_step_log_idempotency_key_index" ON "saga_step_log" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "saga_step_log_execute_status_index" ON "saga_step_log" USING btree ("execute_status");--> statement-breakpoint
CREATE INDEX "saga_step_log_compensate_status_index" ON "saga_step_log" USING btree ("compensate_status");