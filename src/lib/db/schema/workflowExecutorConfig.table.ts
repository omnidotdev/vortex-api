import { index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { organizationRlsPolicy } from "lib/db/util/rls.util";

/**
 * Per-org executor configuration for BYOK (Bring Your Own Key) workflow backends.
 *
 * An org registers a named executor config (e.g., "acme-temporal") and sets
 * workflow.executor to that slug. dispatch.ts resolves the slug to credentials
 * stored here, decrypts them, and creates a backend client for that workflow.
 *
 * config column stores AES-256-GCM encrypted JSON. Shape per type:
 *   temporal: { address: string, namespace?: string, taskQueue?: string }
 */
export const workflowExecutorConfigTable = pgTable(
  "workflow_executor_config",
  {
    id: generateDefaultId(),
    /** IDP organization ID (from Gatekeeper) */
    organizationId: text().notNull(),
    /** Slug used in workflow.executor (e.g., "acme-temporal") */
    slug: text().notNull(),
    /** Backend type (currently only "temporal") */
    type: text().notNull(),
    /** AES-256-GCM encrypted JSON config (use lib/crypto/encryption.ts) */
    config: text().notNull(),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    // One config per slug per org
    uniqueIndex("workflow_executor_config_org_slug_idx").on(
      table.organizationId,
      table.slug,
    ),
    index().on(table.organizationId),
    organizationRlsPolicy(),
  ],
);
