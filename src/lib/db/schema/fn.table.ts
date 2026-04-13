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
 * FaaS function registry table.
 * Stores registered functions (inline JS or WASM modules) that can be
 * invoked via HTTP endpoint.
 */
export const fnTable = pgTable(
  "fn",
  {
    id: generateDefaultId(),
    /** IDP organization ID (from Gatekeeper) */
    organizationId: text().notNull(),
    name: text().notNull(),
    /** Runtime type: "js" for inline JavaScript, "wasm" for WASM modules */
    runtime: text().notNull(),
    /** Inline JS source code (when runtime is "js") */
    source: text(),
    /** URL to a WASM module (when runtime is "wasm") */
    wasmModuleUrl: text(),
    /** Execution backend: "local" (in-process sandbox) or "spinkube" */
    executor: text().default("local").notNull(),
    /** Resource limits: { memoryMb?, timeoutMs?, maxOutputBytes? } */
    limits: jsonb(),
    /** Arbitrary user-defined metadata */
    metadata: jsonb(),
    /** Total number of times this function has been invoked */
    invocationCount: integer().default(0).notNull(),
    /** Timestamp of the most recent invocation */
    lastInvokedAt: generateDefaultDate(),
    // Timestamps
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index().on(table.organizationId),
    index().on(table.name),
    // Unique name per organization
    uniqueIndex("unique_organization_fn_name").on(
      table.organizationId,
      table.name,
    ),
  ],
);

// Relations are defined in relations.ts to avoid circular imports
