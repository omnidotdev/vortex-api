import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { workspaceRole } from "./enums";
import { userTable } from "./user.table";
import { workspaceTable } from "./workspace.table";

/**
 * Invitation table for workspace invitations.
 * Tracks pending invitations to join a workspace.
 */
export const invitationTable = pgTable(
  "invitation",
  {
    id: generateDefaultId(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaceTable.id, { onDelete: "cascade" }),
    email: text().notNull(),
    role: workspaceRole().notNull().default("member"),
    invitedBy: uuid()
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    expiresAt: generateDefaultDate(),
    acceptedAt: generateDefaultDate(),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index().on(table.workspaceId),
    index().on(table.email),
    // Prevent duplicate pending invitations
    uniqueIndex("unique_pending_invitation").on(table.workspaceId, table.email),
  ],
);

// Relations are defined in relations.ts to avoid circular imports
