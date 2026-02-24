ALTER TABLE "event_schema" DROP CONSTRAINT "event_schema_name_unique";--> statement-breakpoint
ALTER TABLE "event_log" ADD COLUMN "specversion" text DEFAULT '1.0';--> statement-breakpoint
ALTER TABLE "event_log" ADD COLUMN "dataschema" text;--> statement-breakpoint
ALTER TABLE "event_schema" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "event_schema" ADD COLUMN "compatibility_mode" text DEFAULT 'backward' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_schema" ADD COLUMN "previous_version_id" uuid;--> statement-breakpoint
ALTER TABLE "event_schema" ADD COLUMN "migration_transform" text;--> statement-breakpoint
CREATE INDEX "event_schema_name_version_idx" ON "event_schema" USING btree ("name","version");--> statement-breakpoint
CREATE INDEX "event_schema_name_idx" ON "event_schema" USING btree ("name");