import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { memberRole, organizationType } from "./enums";
import { userTable } from "./user.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * User organization membership table.
 *
 * Persists organization claims from the IDP for:
 * - Offline access (when IDP is temporarily unavailable)
 * - Query optimization (find all orgs a user belongs to)
 * - Audit trail (track membership changes over time)
 */
export const userOrganizationTable = pgTable(
  "user_organization",
  {
    id: generateDefaultId(),
    /** Local user ID (FK to users table) */
    userId: uuid()
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    /** IDP organization ID */
    organizationId: text().notNull(),
    /** Organization slug (cached from IDP) */
    slug: text().notNull(),
    /** Organization name (cached from IDP, for display) */
    name: text(),
    /** Organization type */
    type: organizationType().notNull().default("team"),
    /** User's role in the organization */
    role: memberRole().notNull().default("member"),
    /** When the membership was synced from IDP */
    syncedAt: generateDefaultDate(),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    unique().on(table.userId, table.organizationId),
    index().on(table.userId),
    index().on(table.organizationId),
  ],
);

/**
 * User organization relations.
 */
/** @knipignore */
export const userOrganizationRelations = relations(
  userOrganizationTable,
  ({ one }) => ({
    user: one(userTable, {
      fields: [userOrganizationTable.userId],
      references: [userTable.id],
    }),
  }),
);

export type InsertUserOrganization = InferInsertModel<
  typeof userOrganizationTable
>;
/** @knipignore */
export type SelectUserOrganization = InferSelectModel<
  typeof userOrganizationTable
>;
