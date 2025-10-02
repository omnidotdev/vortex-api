import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { userTable } from "lib/db/schema/user.table";
import { generateDefaultDate, generateDefaultId } from "lib/db/util";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Workflow table for storing user-created automation workflows.
 * Stores the workflow definition for loading/saving in the visual editor.
 */
export const workflowTable = pgTable(
  "workflow",
  {
    id: generateDefaultId(),
    name: text().notNull(),
    description: text(),
    // JSON field to store the complete workflow definition (nodes, edges, etc.)
    definition: jsonb().notNull(),
    // Workflow status
    isActive: boolean().default(true).notNull(),
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
    index().on(table.isActive),
  ],
);

export type InsertWorkflow = InferInsertModel<typeof workflowTable>;
export type SelectWorkflow = InferSelectModel<typeof workflowTable>;
