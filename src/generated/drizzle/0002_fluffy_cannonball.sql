CREATE TABLE "workflow_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"long_description" text,
	"category" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"icon_url" text,
	"definition" jsonb NOT NULL,
	"required_integrations" text[] DEFAULT '{}' NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" text DEFAULT '0',
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_template_id_index" ON "workflow_template" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_template_slug_idx" ON "workflow_template" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "workflow_template_category_idx" ON "workflow_template" USING btree ("category");--> statement-breakpoint
CREATE INDEX "workflow_template_is_public_idx" ON "workflow_template" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "workflow_template_is_featured_idx" ON "workflow_template" USING btree ("is_featured");