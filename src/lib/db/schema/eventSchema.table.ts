import { index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Event schema catalog table.
 * Stores known event types emitted by Omni services for use in the workflow builder UI.
 * PostGraphile auto-exposes this table as a GraphQL type.
 * @knipignore - Exported for database schema and migrations
 */
export const eventSchemaTable = pgTable(
  "event_schema",
  {
    id: generateDefaultId(),
    /** Dot-separated event name, e.g. "synapse.provider.health_changed" */
    name: text().notNull(),
    /** Service that emits this event, e.g. "synapse-api" */
    source: text().notNull(),
    description: text(),
    /** JSON Schema for the OmniEvent `data` field */
    payloadSchema: jsonb(),
    /** Enforcement level: strict (reject invalid), warn (log), none (skip) */
    enforcement: text().notNull().default("warn"),
    /** Monotonic version number */
    version: integer().notNull().default(1),
    /** Schema evolution mode: backward, forward, full, none */
    compatibilityMode: text("compatibility_mode").notNull().default("backward"),
    /** FK to previous version of this schema (self-referential) */
    previousVersionId: uuid("previous_version_id"),
    /** JSONata expression for migrating data between versions */
    migrationTransform: text("migration_transform"),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    index("event_schema_name_version_idx").on(table.name, table.version),
    index("event_schema_name_idx").on(table.name),
  ],
);

/** @knipignore - Used by API routes and seed scripts */
export type EventSchema = InferSelectModel<typeof eventSchemaTable>;
/** @knipignore - Used by seed scripts */
export type InsertEventSchema = InferInsertModel<typeof eventSchemaTable>;
