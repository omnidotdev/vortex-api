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
import { integrationDefinitionTable } from "./integrationDefinition.table";
import { mcpServerTable } from "./mcpServer.table";
import { workspaceTable } from "./workspace.table";

/**
 * Integration table for storing workspace integration configurations.
 * Stores API keys, tokens, and configuration for external services.
 *
 * Each integration is linked to:
 * - An integration definition (the "template" - GitHub, Discord, etc.)
 * - An auto-created MCP server (the runtime connection)
 */
export const integrationTable = pgTable(
  "integration",
  {
    id: generateDefaultId(),
    // Workspace ownership (multi-tenancy)
    workspaceId: uuid()
      .notNull()
      .references(() => workspaceTable.id, { onDelete: "cascade" }),
    // Link to integration definition (the catalog entry)
    definitionId: text().references(() => integrationDefinitionTable.id, {
      onDelete: "set null",
    }),
    // Link to auto-created MCP server (implementation detail)
    mcpServerId: uuid().references(() => mcpServerTable.id, {
      onDelete: "set null",
    }),
    // Integration type (discord, slack, notion, linkedin, etc.)
    // Kept for backwards compatibility and quick filtering
    type: text().notNull(),
    name: text().notNull(), // User-defined name for this integration
    // Integration status
    isEnabled: boolean().default(false).notNull(),
    // Configuration and credentials (ENCRYPTED - use crypto/encryption.ts)
    config: jsonb().notNull().default({}),
    // Timestamps
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    // Note: id already has unique index from primaryKey()
    index("integration_workspace_id_idx").on(table.workspaceId),
    index("integration_definition_id_idx").on(table.definitionId),
    index("integration_mcp_server_id_idx").on(table.mcpServerId),
    index("integration_type_idx").on(table.type),
    index("integration_is_enabled_idx").on(table.isEnabled),
    // Ensure one integration per type per workspace
    uniqueIndex("unique_workspace_integration_type").on(
      table.workspaceId,
      table.type,
    ),
  ],
);

// Relations are defined in relations.ts to avoid circular imports
