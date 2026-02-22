import {
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
import { workflowTable } from "./workflow.table";

/**
 * Workflow version history table for tracking definition changes.
 * Stores a snapshot of the workflow definition at each version bump.
 * @knipignore Used by relations and version lookup
 */
export const workflowVersionTable = pgTable(
  "workflow_version",
  {
    id: generateDefaultId(),
    /** Parent workflow */
    workflowId: uuid()
      .notNull()
      .references(() => workflowTable.id, { onDelete: "cascade" }),
    /** Version number (matches `workflowTable.version` at time of save) */
    version: integer().notNull(),
    /** Frozen workflow definition at this version */
    definition: jsonb().notNull(),
    /** User who created this version */
    createdBy: uuid().references(() => userTable.id, { onDelete: "set null" }),
    createdAt: generateDefaultDate(),
    /** Optional description of what changed */
    changeNote: text(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index().on(table.workflowId),
    uniqueIndex().on(table.workflowId, table.version),
  ],
);
