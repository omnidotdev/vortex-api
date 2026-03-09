ALTER TABLE "user_organization" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user_organization" ALTER COLUMN "type" SET DEFAULT 'team';--> statement-breakpoint
ALTER TABLE "user_organization" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user_organization" ALTER COLUMN "role" SET DEFAULT 'member';--> statement-breakpoint
DROP TYPE "public"."member_role";--> statement-breakpoint
DROP TYPE "public"."organization_type";