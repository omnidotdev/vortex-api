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

/**
 * Plugin table for Extism WASM plugin registry.
 * Stores plugin metadata, manifest, and WASM binary location.
 */
export const pluginTable = pgTable(
  "plugin",
  {
    id: generateDefaultId(),
    /** IDP organization ID (from Gatekeeper) */
    organizationId: text().notNull(),
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
    index().on(table.organizationId),
    index().on(table.name),
    index().on(table.isEnabled),
    // Ensure unique name+version per organization
    uniqueIndex("unique_organization_plugin_version").on(
      table.organizationId,
      table.name,
      table.version,
    ),
  ],
);

// Relations are defined in relations.ts to avoid circular imports
