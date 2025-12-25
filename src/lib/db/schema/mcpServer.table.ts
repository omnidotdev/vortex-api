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
 * MCP Server table for storing workspace MCP server configurations.
 * Stores connection details for Model Context Protocol servers
 * (LLM providers, code execution, databases, etc.)
 */
export const mcpServerTable = pgTable(
  "mcp_server",
  {
    id: generateDefaultId(),
    // Workspace ownership (multi-tenancy)
    workspaceId: uuid()
      .notNull()
      .references(() => workspaceTable.id, { onDelete: "cascade" }),
    // Server identification
    name: text().notNull(), // User-defined name (e.g., "OpenRouter LLM")
    // Server type for categorization (llm, code, database, custom)
    type: text().notNull().default("custom"),
    // MCP server spawn configuration
    command: text().notNull(), // Command to run (e.g., "npx")
    args: jsonb().notNull().default([]), // Arguments array (e.g., ["-y", "any-chat-completions-mcp"])
    // Environment variables (encrypted at rest, contains API keys)
    env: jsonb().notNull().default({}),
    // Working directory for the MCP server process
    cwd: text(),
    // Server status
    isEnabled: boolean().default(true).notNull(),
    // Timestamps
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index().on(table.workspaceId),
    index().on(table.type),
    index().on(table.isEnabled),
    // Unique name per workspace
    uniqueIndex("unique_workspace_mcp_server_name").on(
      table.workspaceId,
      table.name,
    ),
  ],
);

// Relations are defined in relations.ts to avoid circular imports
