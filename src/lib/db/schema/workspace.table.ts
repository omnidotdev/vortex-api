import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { tier } from "./enums";

import type { InferInsertModel } from "drizzle-orm";

/**
 * Workspace table for multi-tenancy.
 * Each workspace can have multiple users with different roles.
 * Linked to Gatekeeper organizations via organizationId.
 */
export const workspaceTable = pgTable(
  "workspace",
  {
    id: generateDefaultId(),
    name: text().notNull(),
    slug: text().unique().notNull(),
    /** Link to Gatekeeper organization */
    organizationId: text().notNull(),
    tier: tier().notNull().default("free"),
    subscriptionId: text(),
    /** Soft-delete timestamp */
    deletedAt: timestamp({ withTimezone: true }),
    /** Reason for deletion (e.g., "organization_deleted") */
    deletionReason: text(),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    uniqueIndex().on(table.slug),
    index().on(table.tier),
    index().on(table.organizationId),
  ],
);

// Relations are defined in relations.ts to avoid circular imports

/** @knipignore Used in test files */
export type InsertWorkspace = InferInsertModel<typeof workspaceTable>;
