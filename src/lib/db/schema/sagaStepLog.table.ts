import {
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { sagaRunTable } from "./sagaRun.table";

/**
 * Saga step log table for tracking individual execute/compensate step pairs
 * within a saga run. Each row represents one step in the saga sequence.
 */
export const sagaStepLogTable = pgTable(
  "saga_step_log",
  {
    id: generateDefaultId(),
    sagaRunId: uuid()
      .notNull()
      .references(() => sagaRunTable.id, { onDelete: "cascade" }),
    stepName: text().notNull(),
    // Composite key for idempotent step execution
    idempotencyKey: text().notNull(),
    // Execute phase status
    executeStatus: text().notNull().default("pending"),
    // Compensate phase status
    compensateStatus: text().notNull().default("pending"),
    // Input/output data for execute phase
    executeInput: jsonb().default({}),
    executeOutput: jsonb(),
    // Input/output data for compensate phase
    compensateInput: jsonb(),
    compensateOutput: jsonb(),
    error: text(),
    startedAt: generateDefaultDate(),
    completedAt: generateDefaultDate(),
    // Timestamps
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index().on(table.sagaRunId),
    index().on(table.idempotencyKey),
    index().on(table.executeStatus),
    index().on(table.compensateStatus),
  ],
);

// Relations are defined in relations.ts to avoid circular imports
