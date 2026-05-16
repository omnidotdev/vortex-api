import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { eventRoutingRuleTable } from "./eventRoutingRule.table";

/**
 * Dead letter event table for persisting failed routing events.
 *
 * Stores events that failed dispatch after retry exhaustion, providing
 * a durable record for debugging and manual retry/resolve via the API.
 */
export const deadLetterEventTable = pgTable(
  "dead_letter_event",
  {
    id: generateDefaultId(),
    originalEventId: text().notNull(),
    eventType: text().notNull(),
    eventSource: text().notNull(),
    eventData: jsonb().notNull(),
    error: text().notNull(),
    errorCode: text().notNull(),
    routingRuleId: uuid()
      .notNull()
      .references(() => eventRoutingRuleTable.id, { onDelete: "cascade" }),
    attempts: integer().notNull().default(1),
    lastAttemptAt: timestamp({ withTimezone: true }),
    resolvedAt: timestamp({ withTimezone: true }),
    organizationId: text().notNull(),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    index("dead_letter_event_org_idx").on(table.organizationId),
    index("dead_letter_event_resolved_idx").on(table.resolvedAt),
    index("dead_letter_event_type_idx").on(table.eventType),
  ],
);
