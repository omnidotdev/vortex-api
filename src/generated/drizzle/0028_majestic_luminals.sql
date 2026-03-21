CREATE TABLE "email_suppression" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"reason" text NOT NULL,
	"source" text,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "email_suppression_id_index" ON "email_suppression" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_suppression_email_idx" ON "email_suppression" USING btree ("email");