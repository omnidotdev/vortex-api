CREATE TABLE "event_routing_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"workflow_id" uuid NOT NULL,
	"source_pattern" text,
	"type_pattern" text NOT NULL,
	"condition" text,
	"transform" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "event_routing_rule" ADD CONSTRAINT "event_routing_rule_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_routing_rule_org_idx" ON "event_routing_rule" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_routing_rule_workflow_idx" ON "event_routing_rule" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "event_routing_rule_enabled_idx" ON "event_routing_rule" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "event_routing_rule_lookup_idx" ON "event_routing_rule" USING btree ("organization_id","enabled","priority");