import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { organizationRlsPolicy } from "lib/db/util/rls.util";
import { workflowTable } from "./workflow.table";

/**
 * Event routing rule table for mapping CloudEvents to workflows.
 * Routes incoming events from Omni services to trigger workflows based on
 * source/type patterns and optional conditions.
 */
export const eventRoutingRuleTable = pgTable(
  "event_routing_rule",
  {
    id: generateDefaultId(),
    /** IDP organization ID (from Gatekeeper) */
    organizationId: text().notNull(),
    /** Target workflow to trigger when event matches */
    workflowId: uuid()
      .notNull()
      .references(() => workflowTable.id, { onDelete: "cascade" }),

    // Event matching patterns (glob-style)
    /** Source pattern to match (e.g., "omni.billing.*") */
    sourcePattern: text(),
    /** Type pattern to match (e.g., "subscription.created") - required */
    typePattern: text().notNull(),

    // Optional JSONPath condition for filtering on event data
    /** JSONPath expression to evaluate against event data */
    condition: text(),
    /** CEL expression for complex boolean filtering (takes precedence over condition) */
    celCondition: text(),
    /** Batch configuration for event accumulation before triggering */
    batch: jsonb(),
    // Optional JSONata transform to apply before passing to workflow
    /** JSONata expression to transform event data */
    transform: text(),

    /** Higher priority rules are evaluated first */
    priority: integer().notNull().default(0),
    /** Whether this rule is active */
    enabled: boolean().notNull().default(true),

    // Timestamps
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    index("event_routing_rule_org_idx").on(table.organizationId),
    index("event_routing_rule_workflow_idx").on(table.workflowId),
    index("event_routing_rule_enabled_idx").on(table.enabled),
    // Compound index for efficient rule matching
    index("event_routing_rule_lookup_idx").on(
      table.organizationId,
      table.enabled,
      table.priority,
    ),
    organizationRlsPolicy(),
  ],
);

// Relations are defined in relations.ts to avoid circular imports
