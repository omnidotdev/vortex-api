import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { workspaceTable } from "./workspace.table";

/**
 * Integration table for storing workspace integration configurations.
 * Stores API keys, tokens, and configuration for external services.
 */
export const integrationTable = pgTable(
  "integration",
  {
    id: generateDefaultId(),
    // Workspace ownership (multi-tenancy)
    workspaceId: uuid()
      .notNull()
      .references(() => workspaceTable.id, { onDelete: "cascade" }),
    // Integration type (discord, slack, notion, linkedin, etc.)
    type: text().notNull(),
    name: text().notNull(), // User-defined name for this integration
    // Integration status
    isEnabled: boolean().default(false).notNull(),
    // Configuration and credentials (encrypted at rest)
    config: jsonb().notNull().default({}),
    // Timestamps
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index().on(table.workspaceId),
    index().on(table.type),
    index().on(table.isEnabled),
    // Ensure one integration per type per workspace
    uniqueIndex("unique_workspace_integration_type").on(
      table.workspaceId,
      table.type,
    ),
  ],
);

// Relations are defined in relations.ts to avoid circular imports
