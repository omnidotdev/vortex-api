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

/**
 * Workflow run table for tracking workflow executions.
 */
export const workflowRunTable = pgTable(
  "workflow_run",
  {
    id: generateDefaultId(),
    // Nullable for DSL-only runs that aren't saved to a workflow
    workflowId: uuid().references(() => workflowTable.id, {
      onDelete: "cascade",
    }),
    // Engine identifiers (Hatchet, Temporal, etc.)
    engineWorkflowId: text().notNull(),
    engineRunId: text().notNull(),
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
    index().on(table.engineWorkflowId),
    index().on(table.completedAt),
  ],
);

// Relations are defined in relations.ts to avoid circular imports
