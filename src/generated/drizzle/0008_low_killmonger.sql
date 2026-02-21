CREATE TABLE "event_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"source" text NOT NULL,
	"subject" text,
	"organization_id" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"correlation_id" text,
	"schema_id" text,
	"timestamp" text NOT NULL,
	"recorded_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "event_log_organization_id_index" ON "event_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_log_type_index" ON "event_log" USING btree ("type");--> statement-breakpoint
CREATE INDEX "event_log_correlation_id_index" ON "event_log" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "event_log_recorded_at_index" ON "event_log" USING btree ("recorded_at");