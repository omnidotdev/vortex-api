CREATE TABLE "event_schema" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL,
	"description" text,
	"payload_schema" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now(),
	CONSTRAINT "event_schema_name_unique" UNIQUE("name")
);
