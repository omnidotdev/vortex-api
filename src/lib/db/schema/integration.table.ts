import {
  pgTable,
  uniqueIndex,
  uuid,
  text,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

import { userTable } from "lib/db/schema/user.table";
import { generateDefaultDate, generateDefaultId } from "lib/db/util";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Integration table for storing user integration configurations.
 * Stores API keys, tokens, and configuration for external services.
 */
export const integrationTable = pgTable(
  "integration",
  {
    id: generateDefaultId(),
    // Integration type (discord, slack, notion, linkedin, etc.)
    type: text().notNull(),
    name: text().notNull(), // User-defined name for this integration
    // Integration status
    isEnabled: boolean().default(false).notNull(),
    // Configuration and credentials
    config: jsonb().notNull().default({}),
    // Owner
    userId: uuid()
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
      }),
    // Timestamps
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index().on(table.userId),
    index().on(table.type),
    // Ensure one integration per type per user
    uniqueIndex("unique_user_integration_type").on(table.userId, table.type),
  ],
);

export type InsertIntegration = InferInsertModel<typeof integrationTable>;
export type SelectIntegration = InferSelectModel<typeof integrationTable>;
