DROP INDEX IF EXISTS "event_schema_name_version_idx";--> statement-breakpoint
ALTER TABLE "event_schema" ADD COLUMN IF NOT EXISTS "organization_id" text;--> statement-breakpoint
UPDATE "event_schema" SET "organization_id" = coalesce(current_setting('app.platform_org_id', true), '33880602-cf32-4d8d-8db3-a4a9994c5d45') WHERE "organization_id" IS NULL;--> statement-breakpoint
ALTER TABLE "event_schema" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "event_schema" ADD COLUMN IF NOT EXISTS "visibility" text DEFAULT 'private' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_schema_name_version_org_idx" ON "event_schema" USING btree ("name","version","organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_schema_org_idx" ON "event_schema" USING btree ("organization_id");
