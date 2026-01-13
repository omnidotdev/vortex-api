ALTER TABLE "workspace" ADD COLUMN "organization_id" text;--> statement-breakpoint
UPDATE "workspace" SET "organization_id" = 'org_default' WHERE "organization_id" IS NULL;--> statement-breakpoint
ALTER TABLE "workspace" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "deletion_reason" text;--> statement-breakpoint
CREATE INDEX "workspace_organization_id_index" ON "workspace" USING btree ("organization_id");