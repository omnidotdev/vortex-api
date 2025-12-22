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
import { userTable } from "./user.table";
import { workspaceTable } from "./workspace.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Plugin table for Extism WASM plugin registry.
 * Stores plugin metadata, manifest, and WASM binary location.
 */
export const pluginTable = pgTable(
  "plugin",
  {
    id: generateDefaultId(),
    // Workspace ownership (multi-tenancy)
    workspaceId: uuid()
      .notNull()
      .references(() => workspaceTable.id, { onDelete: "cascade" }),
    // Plugin metadata
    name: text().notNull(),
    description: text(),
    version: text().notNull(),
    // Plugin manifest (JSON Schema for inputs/outputs, runtime config)
    manifest: jsonb().notNull(),
    // WASM binary location and integrity
    wasmUrl: text().notNull(),
    wasmHash: text().notNull(), // SHA256 hash for integrity verification
    // Plugin status
    isEnabled: boolean().default(true).notNull(),
    isVerified: boolean().default(false).notNull(), // Verified by platform
    // User-provided configuration (credentials, settings)
    config: jsonb().default({}),
    // Author
    authorId: uuid().references(() => userTable.id, { onDelete: "set null" }),
    // Timestamps
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index().on(table.workspaceId),
    index().on(table.name),
    index().on(table.isEnabled),
    // Ensure unique name+version per workspace
    uniqueIndex("unique_workspace_plugin_version").on(
      table.workspaceId,
      table.name,
      table.version,
    ),
  ],
);

// Relations are defined in relations.ts to avoid circular imports

export type InsertPlugin = InferInsertModel<typeof pluginTable>;
export type SelectPlugin = InferSelectModel<typeof pluginTable>;
