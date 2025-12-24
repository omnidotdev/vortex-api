-- Make workflow_id nullable to support DSL-only runs
ALTER TABLE "workflow_run" ALTER COLUMN "workflow_id" DROP NOT NULL;
