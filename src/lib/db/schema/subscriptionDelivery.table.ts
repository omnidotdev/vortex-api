import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { organizationRlsPolicy } from "lib/db/util/rls.util";
import { eventSubscriptionTable } from "./eventSubscription.table";

/**
 * Subscription delivery table for tracking webhook delivery attempts.
 * Records each delivery attempt with status, retry tracking, and error details.
 */
export const subscriptionDeliveryTable = pgTable(
  "subscription_delivery",
  {
    id: generateDefaultId(),
    /** Parent subscription */
    subscriptionId: uuid()
      .notNull()
      .references(() => eventSubscriptionTable.id, { onDelete: "cascade" }),
    /** Original event ID that triggered delivery */
    eventId: text().notNull(),
    /** Event type for filtering/debugging */
    eventType: text().notNull(),
    /** Organization ID for scoping queries */
    organizationId: text().notNull(),
    /** Stored delivery payload for retry attempts */
    payload: jsonb(),

    /** Delivery status */
    status: text().notNull().default("pending"),
    /** Number of delivery attempts */
    attempts: integer().notNull().default(0),
    /** HTTP response status code from target */
    httpStatus: integer(),
    /** Truncated error message on failure */
    error: text(),

    /** Next retry timestamp (for pending retries) */
    nextRetryAt: generateDefaultDate(),
    /** When delivery completed successfully or moved to DLQ */
    completedAt: generateDefaultDate(),

    createdAt: generateDefaultDate(),
  },
  (table) => [
    index("subscription_delivery_sub_idx").on(table.subscriptionId),
    index("subscription_delivery_status_retry_idx").on(
      table.status,
      table.nextRetryAt,
    ),
    index("subscription_delivery_org_idx").on(table.organizationId),
    organizationRlsPolicy(),
  ],
);

// Relations are defined in relations.ts to avoid circular imports
