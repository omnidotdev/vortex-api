import {
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
 * MCP Server table for storing MCP server configurations.
 * Each workspace can have multiple MCP servers configured.
 */
export const mcpServerTable = pgTable(
  "mcp_server",
  {
    id: generateDefaultId(),
    // Workspace ownership (multi-tenancy)
    workspaceId: uuid()
      .notNull()
      .references(() => workspaceTable.id, { onDelete: "cascade" }),
    // Server metadata
    name: text().notNull(),
    description: text(),
    // MCP server command configuration
    command: text().notNull(), // e.g., "npx"
    args: jsonb().$type<string[]>().notNull().default([]), // e.g., ["@activepieces/mcp-slack"]
    env: jsonb().$type<Record<string, string>>().default({}), // Environment variables
    // Timestamps
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index().on(table.workspaceId),
    index().on(table.name),
  ],
);

// Relations are defined in relations.ts to avoid circular imports
