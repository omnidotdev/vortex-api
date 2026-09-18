import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { organizationRlsPolicy } from "lib/db/util/rls.util";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Event schema catalog table.
 * Stores known event types emitted by Omni services for use in the workflow builder UI.
 * PostGraphile auto-exposes this table as a GraphQL type.
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
    /** Owning organization (IDP org ID) */
    organizationId: text().notNull(),
    /** Catalog visibility: public (all orgs) or private (owning org only) */
    visibility: text().notNull().default("private"),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex("event_schema_name_version_org_idx").on(
      table.name,
      table.version,
      table.organizationId,
    ),
    index("event_schema_name_idx").on(table.name),
    index("event_schema_org_idx").on(table.organizationId),
    organizationRlsPolicy(),
  ],
);

export type EventSchema = InferSelectModel<typeof eventSchemaTable>;
export type InsertEventSchema = InferInsertModel<typeof eventSchemaTable>;
