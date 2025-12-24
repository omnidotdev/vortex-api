import {
  index,
  pgTable,
  primaryKey,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate } from "lib/db/util";
import { workspaceRole } from "./enums";
import { userTable } from "./user.table";
import { workspaceTable } from "./workspace.table";

/**
 * Junction table for workspace membership.
 * Each user can belong to multiple workspaces with different roles.
 */
export const workspaceUserTable = pgTable(
  "workspace_user",
  {
    workspaceId: uuid()
      .notNull()
      .references(() => workspaceTable.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    role: workspaceRole().notNull().default("member"),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    uniqueIndex().on(table.workspaceId, table.userId),
    index().on(table.userId),
  ],
);

// Relations are defined in relations.ts to avoid circular imports
