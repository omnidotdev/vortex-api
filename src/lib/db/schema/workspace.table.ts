import { index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import type { InferInsertModel } from "drizzle-orm";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { tier } from "./enums";

/**
 * Workspace table for multi-tenancy.
 * Each workspace can have multiple users with different roles.
 */
export const workspaceTable = pgTable(
  "workspace",
  {
    id: generateDefaultId(),
    name: text().notNull(),
    slug: text().unique().notNull(),
    tier: tier().notNull().default("free"),
    subscriptionId: text(),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    uniqueIndex().on(table.slug),
    index().on(table.tier),
  ],
);

// Relations are defined in relations.ts to avoid circular imports

/** @knipignore Used in test files */
export type InsertWorkspace = InferInsertModel<typeof workspaceTable>;
