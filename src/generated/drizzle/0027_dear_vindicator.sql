CREATE TABLE "email_suppression" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"reason" text NOT NULL,
	"source" text,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	CONSTRAINT "email_suppression_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "email_suppression_email_index" ON "email_suppression" USING btree ("email");--> statement-breakpoint
ALTER TABLE "workflow" ADD CONSTRAINT "workflow_executor_check" CHECK ("workflow"."executor" IN ('hatchet', 'temporal', 'local'));