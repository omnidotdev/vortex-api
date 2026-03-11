DROP INDEX "event_schema_name_version_idx";--> statement-breakpoint
ALTER TABLE "event_schema" ADD COLUMN "organization_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "event_schema" ADD COLUMN "visibility" text DEFAULT 'private' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "event_schema_name_version_org_idx" ON "event_schema" USING btree ("name","version","organization_id");--> statement-breakpoint
CREATE INDEX "event_schema_org_idx" ON "event_schema" USING btree ("organization_id");