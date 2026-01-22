CREATE TABLE "oauth_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" text NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"definition_id" text NOT NULL,
	"code_verifier" text,
	"code_challenge" text,
	"redirect_uri" text NOT NULL,
	"scopes" text[] NOT NULL,
	"return_url" text,
	"expires_at" timestamp(6) with time zone NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "oauth_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_type" text DEFAULT 'Bearer' NOT NULL,
	"scope" text NOT NULL,
	"expires_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "integration" ADD COLUMN "auth_method" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "integration" ADD COLUMN "oauth_status" text;--> statement-breakpoint
ALTER TABLE "integration" ADD COLUMN "oauth_connected_at" timestamp(6) with time zone;--> statement-breakpoint
ALTER TABLE "oauth_token" ADD CONSTRAINT "oauth_token_integration_id_integration_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integration"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_state_state_idx" ON "oauth_state" USING btree ("state");--> statement-breakpoint
CREATE INDEX "oauth_state_organization_id_idx" ON "oauth_state" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "oauth_state_provider_idx" ON "oauth_state" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "oauth_state_expires_at_idx" ON "oauth_state" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "oauth_token_integration_id_idx" ON "oauth_token" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX "oauth_token_organization_id_idx" ON "oauth_token" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "oauth_token_provider_idx" ON "oauth_token" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "oauth_token_expires_at_idx" ON "oauth_token" USING btree ("expires_at");