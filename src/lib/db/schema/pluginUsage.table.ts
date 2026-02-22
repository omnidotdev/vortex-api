import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { pluginTable } from "./plugin.table";

/**
 * Plugin usage tracking table.
 * Records each invocation of a plugin function for analytics and billing.
 */
export const pluginUsageTable = pgTable(
  "plugin_usage",
  {
    id: generateDefaultId(),
    pluginId: uuid()
      .notNull()
      .references(() => pluginTable.id, { onDelete: "cascade" }),
    /** IDP organization ID */
    organizationId: text().notNull(),
    /** Workflow that triggered the invocation */
    workflowId: uuid(),
    /** Run that triggered the invocation */
    runId: uuid(),
    /** Name of the function called */
    functionName: text().notNull(),
    /** Execution duration in milliseconds */
    durationMs: integer().notNull(),
    /** Whether the invocation succeeded */
    success: boolean().notNull(),
    /** When the function was executed */
    executedAt: generateDefaultDate(),
  },
  (table) => [
    index().on(table.pluginId),
    index().on(table.organizationId),
    index().on(table.executedAt),
  ],
);
