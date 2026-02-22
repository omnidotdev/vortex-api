import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { generateDefaultId } from "lib/db/util";

/**
 * Transactional outbox table for reliable event publishing.
 *
 * Events are inserted into this table within the same transaction as
 * the business operation. A background sweeper publishes them to
 * Iggy and marks them as published, ensuring at-least-once delivery.
 * @knipignore Used by vortex-worker outbox sweeper
 */
export const outboxTable = pgTable(
  "outbox",
  {
    id: generateDefaultId(),
    topic: text().notNull(),
    payload: jsonb().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    publishedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index("outbox_pending_idx").on(table.publishedAt),
    index().on(table.createdAt),
  ],
);
