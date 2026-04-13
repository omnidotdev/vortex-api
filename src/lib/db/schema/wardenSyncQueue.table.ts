import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";

/**
 * Warden sync queue for retrying failed authorization tuple writes.
 *
 * When a Warden (OpenFGA) tuple write fails during IDP webhook processing,
 * the operation is enqueued here for background retry with exponential backoff.
 * Prevents users from being permanently locked out due to transient Warden
 * unavailability during organization creation or membership changes.
 */
export const wardenSyncQueueTable = pgTable(
  "warden_sync_queue",
  {
    id: generateDefaultId(),
    operation: text().notNull(), // "write" or "delete"
    tuples: jsonb()
      .notNull()
      .$type<Array<{ user: string; relation: string; object: string }>>(),
    description: text().notNull(),
    status: text().notNull().default("pending"), // pending, retrying, completed, failed
    attempts: integer().notNull().default(0),
    maxAttempts: integer().notNull().default(10),
    nextRetryAt: timestamp({ withTimezone: true }).notNull(),
    lastError: text(),
    completedAt: timestamp({ withTimezone: true }),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    index("warden_sync_queue_status_retry_idx").on(
      table.status,
      table.nextRetryAt,
    ),
  ],
);
