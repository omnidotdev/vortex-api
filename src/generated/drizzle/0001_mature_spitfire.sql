CREATE INDEX "event_log_source_index" ON "event_log" USING btree ("source");--> statement-breakpoint
CREATE INDEX "workflow_executor_index" ON "workflow" USING btree ("executor");--> statement-breakpoint
CREATE INDEX "workflow_run_created_at_index" ON "workflow_run" USING btree ("created_at");