import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Workflow Template table for storing pre-built workflow definitions.
 * Users can clone these templates to create their own workflows.
 */
export const workflowTemplateTable = pgTable(
  "workflow_template",
  {
    id: generateDefaultId(),
    /** Unique slug for the template (e.g., "discord-send-message") */
    slug: text().notNull(),
    /** Display name */
    name: text().notNull(),
    /** Short description */
    description: text(),
    /** Detailed description with usage instructions (markdown) */
    longDescription: text("long_description"),
    /** Category for filtering (e.g., "communication", "notifications") */
    category: text().notNull(),
    /** Tags for search (e.g., ["discord", "messaging", "bot"]) */
    tags: text().array().notNull().default([]),
    /** Icon URL for display */
    iconUrl: text("icon_url"),
    /** The workflow definition (DSL format) */
    definition: jsonb().notNull(),
    /** Required integrations (by integration definition ID) */
    requiredIntegrations: text("required_integrations")
      .array()
      .notNull()
      .default([]),
    /** Whether the template is publicly visible */
    isPublic: boolean("is_public").default(true).notNull(),
    /** Whether the template is featured/promoted */
    isFeatured: boolean("is_featured").default(false).notNull(),
    /** Display order for sorting */
    sortOrder: text("sort_order").default("0"),
    /** Timestamps */
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    uniqueIndex("workflow_template_slug_idx").on(table.slug),
    index("workflow_template_category_idx").on(table.category),
    index("workflow_template_is_public_idx").on(table.isPublic),
    index("workflow_template_is_featured_idx").on(table.isFeatured),
  ],
);

/** @knipignore - Used by API routes and seed scripts */
export type WorkflowTemplate = InferSelectModel<typeof workflowTemplateTable>;
export type InsertWorkflowTemplate = InferInsertModel<
  typeof workflowTemplateTable
>;
