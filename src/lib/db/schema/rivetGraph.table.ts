import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";

/**
 * Rivet Graph table for storing Rivet AI agent graph definitions.
 * Stores serialized graph project JSON per organization.
 */
export const rivetGraphTable = pgTable(
  "rivet_graph",
  {
    id: generateDefaultId(),
    /** IDP organization ID (from Gatekeeper) */
    organizationId: text().notNull(),
    // Graph metadata
    name: text().notNull(),
    description: text(),
    // Serialized Rivet project JSON
    graphJson: jsonb().notNull(),
    // Version tracking
    version: integer().default(1).notNull(),
    // Timestamps
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index().on(table.organizationId),
    // Unique name per organization
    uniqueIndex("unique_organization_rivet_graph_name").on(
      table.organizationId,
      table.name,
    ),
  ],
);

// Relations are defined in relations.ts to avoid circular imports
