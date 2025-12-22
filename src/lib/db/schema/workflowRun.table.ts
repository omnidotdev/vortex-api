import {
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { workflowTable } from "./workflow.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Workflow run table for tracking Temporal workflow executions.
 */
export const workflowRunTable = pgTable(
  "workflow_run",
  {
    id: generateDefaultId(),
    workflowId: uuid()
      .notNull()
      .references(() => workflowTable.id, { onDelete: "cascade" }),
    // Temporal identifiers
    temporalWorkflowId: text().notNull(),
    temporalRunId: text().notNull(),
    // Execution status (text for flexibility - pending, running, completed, failed, cancelled, etc.)
    status: text().notNull().default("pending"),
    startedAt: generateDefaultDate(),
    completedAt: generateDefaultDate(),
    // Input/output data
    input: jsonb(),
    output: jsonb(),
    error: text(),
    // Timestamps
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index().on(table.workflowId),
    index().on(table.status),
    index().on(table.temporalWorkflowId),
    index().on(table.completedAt),
  ],
);

// Relations are defined in relations.ts to avoid circular imports

export type InsertWorkflowRun = InferInsertModel<typeof workflowRunTable>;
export type SelectWorkflowRun = InferSelectModel<typeof workflowRunTable>;
