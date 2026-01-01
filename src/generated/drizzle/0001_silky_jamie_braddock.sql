ALTER TABLE "integration_definition" ADD COLUMN "setup_steps" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "integration_definition" ADD COLUMN "docs_url" text;--> statement-breakpoint
ALTER TABLE "integration_definition" ADD COLUMN "supports_o_auth" boolean DEFAULT false NOT NULL;