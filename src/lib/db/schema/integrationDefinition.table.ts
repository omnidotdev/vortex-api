import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
} from "drizzle-orm/pg-core";

import { generateDefaultDate } from "lib/db/util";

/**
 * Integration Definition table for storing available integration types.
 * These are the "catalog" entries that define what integrations are available
 * (GitHub, Discord, Slack, etc.) and how to configure them.
 */
export const integrationDefinitionTable = pgTable(
  "integration_definition",
  {
    // Unique identifier (e.g., 'github', 'discord', 'slack')
    id: text().primaryKey(),
    // Display name (e.g., "GitHub", "Discord")
    name: text().notNull(),
    // Description of the integration
    description: text(),
    // Icon URL for display
    iconUrl: text(),
    // Category for grouping (developer, communication, ai, productivity, payments, email, sms)
    category: text().notNull().default("custom"),
    // Authentication type (api_key, bearer_token, oauth2, custom)
    authType: text().notNull().default("api_key"),
    // JSON schema defining the credential fields required
    // e.g., { "apiKey": { "type": "string", "label": "API Key", "secret": true } }
    authFields: jsonb().notNull().default({}),
    // MCP package name (e.g., "@activepieces/piece-github")
    mcpPackage: text().notNull(),
    // Command to run the MCP server (default: "npx")
    mcpCommand: text().notNull().default("npx"),
    // Arguments template for the MCP server
    // Credentials are interpolated using {{fieldName}} syntax
    mcpArgs: jsonb().notNull().default([]),
    // Keep the MCP server running (for real-time services like Discord bots)
    keepAlive: boolean().notNull().default(false),
    // Idle timeout in milliseconds before disconnecting (default: 5 minutes)
    // Only applies when keepAlive is false
    idleTimeoutMs: integer().notNull().default(300000),
    // Whether this integration is featured in the catalog
    isFeatured: boolean().notNull().default(false),
    // Whether this integration is available for use
    isEnabled: boolean().notNull().default(true),
    // Timestamps
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    // Note: id already has unique index from primaryKey()
    index("integration_definition_category_idx").on(table.category),
    index("integration_definition_is_featured_idx").on(table.isFeatured),
    index("integration_definition_is_enabled_idx").on(table.isEnabled),
  ],
);

// Type for auth field schema
/** @knipignore */
export interface AuthFieldSchema {
  type: "string" | "text" | "json";
  label: string;
  description?: string;
  placeholder?: string;
  secret?: boolean; // If true, mask input and never return in queries
  required?: boolean;
}

/** @knipignore */
export type AuthFields = Record<string, AuthFieldSchema>;
