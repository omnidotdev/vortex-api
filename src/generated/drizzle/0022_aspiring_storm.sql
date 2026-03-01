CREATE TABLE "workflow_permission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"permission" text NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "workflow_permission" ADD CONSTRAINT "workflow_permission_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_permission" ADD CONSTRAINT "workflow_permission_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_permission" ADD CONSTRAINT "workflow_permission_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_permission_id_index" ON "workflow_permission" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_permission_workflow_id_user_id_index" ON "workflow_permission" USING btree ("workflow_id","user_id");--> statement-breakpoint
CREATE INDEX "workflow_permission_workflow_id_index" ON "workflow_permission" USING btree ("workflow_id");