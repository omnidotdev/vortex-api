import {
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { workflowRunTable } from "./workflowRun.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Workflow step log table for detailed step-level execution tracking.
 */
export const workflowStepLogTable = pgTable(
  "workflow_step_log",
  {
    id: generateDefaultId(),
    workflowRunId: uuid()
      .notNull()
      .references(() => workflowRunTable.id, { onDelete: "cascade" }),
    // Step identification (from workflow definition)
    stepId: text().notNull(),
    stepType: text().notNull(),
    stepName: text().notNull(),
    // Execution status (text for flexibility - pending, running, completed, failed, skipped, etc.)
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
    index().on(table.workflowRunId),
    index().on(table.stepId),
    index().on(table.status),
    index().on(table.completedAt),
  ],
);

// Relations are defined in relations.ts to avoid circular imports

export type InsertWorkflowStepLog = InferInsertModel<
  typeof workflowStepLogTable
>;
export type SelectWorkflowStepLog = InferSelectModel<
  typeof workflowStepLogTable
>;
