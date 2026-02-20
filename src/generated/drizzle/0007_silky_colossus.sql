ALTER TABLE "mcp_server" ALTER COLUMN "command" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_server" ADD COLUMN "transport" text DEFAULT 'stdio';--> statement-breakpoint
ALTER TABLE "mcp_server" ADD COLUMN "url" text;--> statement-breakpoint
ALTER TABLE "mcp_server" ADD COLUMN "headers" jsonb;