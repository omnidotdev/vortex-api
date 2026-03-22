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
CREATE INDEX "warden_sync_queue_status_retry_idx" ON "warden_sync_queue" USING btree ("status","next_retry_at");