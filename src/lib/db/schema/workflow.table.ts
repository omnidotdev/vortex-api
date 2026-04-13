import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { userTable } from "./user.table";

import type { InferInsertModel } from "drizzle-orm";

/**
 * Workflow table for storing user-created automation workflows.
 * Stores the workflow definition for loading/saving in the visual editor.
 */
export const workflowTable = pgTable(
  "workflow",
  {
    id: generateDefaultId(),
    /** IDP organization ID (from Gatekeeper) */
    organizationId: text().notNull(),
    name: text().notNull(),
    description: text(),
    // JSON field to store the complete workflow definition (nodes, edges, etc.)
    definition: jsonb().notNull(),
    // Workflow status
    isActive: boolean().default(true).notNull(),
    // Execution backend: "hatchet" (default) | "temporal" | "local"
    executor: text().default("hatchet").notNull(),
    /** Monotonically increasing definition version */
    version: integer().default(1).notNull(),
    // Trigger configuration
    cronExpression: text(), // For cron triggers (e.g., "0 9 * * MON")
    webhookSecret: text(), // For webhook authentication
    // Execution tracking (text for flexibility - success, failure, running, etc.)
    lastRunAt: generateDefaultDate(),
    lastRunStatus: text(),
    // Creator (for audit)
    createdBy: uuid().references(() => userTable.id, { onDelete: "set null" }),
    // Timestamps
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index().on(table.organizationId),
    index().on(table.isActive),
    index().on(table.createdBy),
    index().on(table.webhookSecret),
    index().on(table.executor),
    check(
      "workflow_executor_check",
      sql`${table.executor} IN ('hatchet', 'temporal', 'local')`,
    ),
  ],
);

// Relations are defined in relations.ts to avoid circular imports

/** @knipignore Used in test files */
export type InsertWorkflow = InferInsertModel<typeof workflowTable>;
