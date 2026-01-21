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

/**
 * Integration table for storing organization integration configurations.
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
    /** IDP organization ID (from Gatekeeper) */
    organizationId: text().notNull(),
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
    index("integration_organization_id_idx").on(table.organizationId),
    index("integration_definition_id_idx").on(table.definitionId),
    index("integration_mcp_server_id_idx").on(table.mcpServerId),
    index("integration_type_idx").on(table.type),
    index("integration_is_enabled_idx").on(table.isEnabled),
    // Ensure one integration per type per organization
    uniqueIndex("unique_organization_integration_type").on(
      table.organizationId,
      table.type,
    ),
  ],
);

// Relations are defined in relations.ts to avoid circular imports
