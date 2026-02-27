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
CREATE TABLE "subscription_delivery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"organization_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"http_status" integer,
	"error" text,
	"next_retry_at" timestamp(6) with time zone DEFAULT now(),
	"completed_at" timestamp(6) with time zone DEFAULT now(),
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "subscription_delivery" ADD CONSTRAINT "subscription_delivery_subscription_id_event_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."event_subscription"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_subscription_org_idx" ON "event_subscription" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_subscription_org_enabled_idx" ON "event_subscription" USING btree ("organization_id","enabled");--> statement-breakpoint
CREATE INDEX "subscription_delivery_sub_idx" ON "subscription_delivery" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscription_delivery_status_retry_idx" ON "subscription_delivery" USING btree ("status","next_retry_at");--> statement-breakpoint
CREATE INDEX "subscription_delivery_org_idx" ON "subscription_delivery" USING btree ("organization_id");