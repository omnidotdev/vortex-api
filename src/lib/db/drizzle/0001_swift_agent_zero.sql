CREATE TABLE "workflow" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"definition" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "post" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "post" CASCADE;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "email" text NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "avatar" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_onboarded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "theme" text DEFAULT 'system';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "plan_type" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow" ADD CONSTRAINT "workflow_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration" ADD CONSTRAINT "integration_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_id_index" ON "workflow" USING btree ("id");--> statement-breakpoint
CREATE INDEX "workflow_user_id_index" ON "workflow" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workflow_is_active_index" ON "workflow" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_id_index" ON "integration" USING btree ("id");--> statement-breakpoint
CREATE INDEX "integration_user_id_index" ON "integration" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "integration_type_index" ON "integration" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_integration_type" ON "integration" USING btree ("user_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_index" ON "user" USING btree ("email");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_email_unique" UNIQUE("email");