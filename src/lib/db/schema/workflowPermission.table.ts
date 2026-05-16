import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { userTable } from "./user.table";
import { workflowTable } from "./workflow.table";

/**
 * Per-workflow permission grants.
 *
 * Allows granting individual users viewer or editor access to specific
 * workflows, bypassing the default org-level RBAC when needed.
 */
export const workflowPermissionTable = pgTable(
  "workflow_permission",
  {
    id: generateDefaultId(),
    workflowId: uuid()
      .notNull()
      .references(() => workflowTable.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    permission: text().notNull(), // "viewer" | "editor"
    grantedBy: uuid().references(() => userTable.id, {
      onDelete: "set null",
    }),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    uniqueIndex().on(table.workflowId, table.userId),
    index().on(table.workflowId),
  ],
);
