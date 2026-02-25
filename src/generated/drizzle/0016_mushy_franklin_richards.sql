DROP INDEX "event_schema_name_version_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "event_schema_name_version_idx" ON "event_schema" USING btree ("name","version");