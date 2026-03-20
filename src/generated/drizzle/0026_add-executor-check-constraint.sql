-- Add CHECK constraint to restrict workflow executor values
ALTER TABLE "workflow" ADD CONSTRAINT "workflow_executor_check" CHECK ("executor" IN ('hatchet', 'temporal', 'local'));
