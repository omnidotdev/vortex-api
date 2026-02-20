import { jsonb, pgTable, text } from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";

/**
 * Event schema catalog table.
 * Stores known event types emitted by Omni services for use in the workflow builder UI.
 * PostGraphile auto-exposes this table as a GraphQL type.
 */
export const eventSchemaTable = pgTable("event_schema", {
  id: generateDefaultId(),
  /** Dot-separated event name, e.g. "synapse.provider.health_changed" */
  name: text().notNull().unique(),
  /** Service that emits this event, e.g. "synapse-api" */
  source: text().notNull(),
  description: text(),
  /** JSON Schema for the OmniEvent `data` field */
  payloadSchema: jsonb(),
  createdAt: generateDefaultDate(),
  updatedAt: generateDefaultDate(),
});
