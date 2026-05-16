import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";

/**
 * Plugin marketplace table.
 * Public registry of published WASM plugins available for installation.
 */
export const pluginMarketplaceTable = pgTable(
  "plugin_marketplace",
  {
    id: generateDefaultId(),
    name: text().notNull(),
    description: text(),
    author: text().notNull(),
    version: text().notNull(),
    wasmUrl: text().notNull(),
    manifest: jsonb().notNull(),
    downloads: integer().default(0).notNull(),
    rating: integer().default(0),
    isVerified: boolean().default(false).notNull(),
    tags: text().array(),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    index().on(table.name),
    index().on(table.author),
    index().on(table.isVerified),
    uniqueIndex("unique_marketplace_name_version").on(
      table.name,
      table.version,
    ),
  ],
);
