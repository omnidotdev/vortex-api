import { index, jsonb, pgTable, text } from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { organizationRlsPolicy } from "lib/db/util/rls.util";

/**
 * Event log table for capturing and replaying platform events.
 *
 * Records all events published to the Iggy streaming layer for
 * audit, debugging, and replay purposes. Aligns with the
 * CloudEvents v1.0 specification where applicable.
 */
export const eventLogTable = pgTable(
  "event_log",
  {
    id: generateDefaultId(),
    /** CloudEvents spec version */
    specversion: text().default("1.0"),
    type: text().notNull(),
    source: text().notNull(),
    subject: text(),
    organizationId: text("organization_id").notNull(),
    data: jsonb().notNull().default({}),
    correlationId: text("correlation_id"),
    schemaId: text("schema_id"),
    /** URI identifying the schema the `data` field adheres to */
    dataschema: text(),
    /** ISO 8601 timestamp from the event itself */
    timestamp: text().notNull(),
    /** When this record was inserted */
    recordedAt: generateDefaultDate(),
  },
  (table) => [
    index().on(table.organizationId),
    index().on(table.type),
    index().on(table.correlationId),
    index().on(table.recordedAt),
    index().on(table.source),
    organizationRlsPolicy(),
  ],
);
