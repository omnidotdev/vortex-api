import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { organizationRlsPolicy } from "lib/db/util/rls.util";
import { workflowRunTable } from "./workflowRun.table";

/**
 * Saga run table for tracking distributed transaction executions.
 * Each saga run is associated with a parent workflow run and tracks
 * the overall status of execute/compensate step pairs.
 */
export const sagaRunTable = pgTable(
  "saga_run",
  {
    id: generateDefaultId(),
    workflowRunId: uuid()
      .notNull()
      .references(() => workflowRunTable.id, { onDelete: "cascade" }),
    organizationId: text().notNull(),
    // Saga lifecycle status
    status: text().notNull().default("running"),
    startedAt: generateDefaultDate(),
    completedAt: generateDefaultDate(),
    error: text(),
    // Timestamps
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index().on(table.workflowRunId),
    index().on(table.organizationId),
    index().on(table.status),
    index().on(table.completedAt),
    organizationRlsPolicy(),
  ],
);

// Relations are defined in relations.ts to avoid circular imports
