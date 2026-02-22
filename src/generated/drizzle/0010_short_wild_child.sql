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
ALTER TABLE "plugin_usage" ADD COLUMN "invocation_source" text DEFAULT 'workflow' NOT NULL;--> statement-breakpoint
ALTER TABLE "dead_letter_event" ADD CONSTRAINT "dead_letter_event_routing_rule_id_event_routing_rule_id_fk" FOREIGN KEY ("routing_rule_id") REFERENCES "public"."event_routing_rule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dead_letter_event_org_idx" ON "dead_letter_event" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "dead_letter_event_resolved_idx" ON "dead_letter_event" USING btree ("resolved_at");--> statement-breakpoint
CREATE INDEX "dead_letter_event_type_idx" ON "dead_letter_event" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "plugin_marketplace_name_index" ON "plugin_marketplace" USING btree ("name");--> statement-breakpoint
CREATE INDEX "plugin_marketplace_author_index" ON "plugin_marketplace" USING btree ("author");--> statement-breakpoint
CREATE INDEX "plugin_marketplace_is_verified_index" ON "plugin_marketplace" USING btree ("is_verified");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_marketplace_name_version" ON "plugin_marketplace" USING btree ("name","version");