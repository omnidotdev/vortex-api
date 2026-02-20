import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";

/**
 * MCP Server table for storing organization MCP server configurations.
 * Stores connection details for Model Context Protocol servers
 * (LLM providers, code execution, databases, etc.)
 */
export const mcpServerTable = pgTable(
  "mcp_server",
  {
    id: generateDefaultId(),
    /** IDP organization ID (from Gatekeeper) */
    organizationId: text().notNull(),
    // Server identification
    name: text().notNull(), // User-defined name (e.g., "OpenRouter LLM")
    // Server type for categorization (llm, code, database, custom)
    type: text().notNull().default("custom"),
    // Transport type (stdio, sse, http)
    transport: text().default("stdio"),
    // MCP server spawn configuration (stdio transport)
    command: text(), // Command to run (e.g., "npx")
    args: jsonb().notNull().default([]), // Arguments array (e.g., ["-y", "any-chat-completions-mcp"])
    // Environment variables (encrypted at rest, contains API keys)
    env: jsonb().notNull().default({}),
    // Working directory for the MCP server process
    cwd: text(),
    // Remote transport configuration (sse/http transport)
    url: text(),
    headers: jsonb(),
    // Server status
    isEnabled: boolean().default(true).notNull(),
    // Timestamps
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index().on(table.organizationId),
    index().on(table.type),
    index().on(table.isEnabled),
    // Unique name per organization
    uniqueIndex("unique_organization_mcp_server_name").on(
      table.organizationId,
      table.name,
    ),
  ],
);

// Relations are defined in relations.ts to avoid circular imports
