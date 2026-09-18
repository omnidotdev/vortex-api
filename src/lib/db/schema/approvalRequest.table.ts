import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { organizationRlsPolicy } from "lib/db/util/rls.util";
import { workflowTable } from "./workflow.table";

/**
 * Approval request table for gate-step workflow pauses.
 *
 * Stores pending approval, signal, and manual gates so that the
 * gate plugin can create a request on execute and poll its status
 * on subsequent check calls.
 */
export const approvalRequestTable = pgTable(
  "approval_request",
  {
    id: generateDefaultId(),
    /** IDP organization ID (from Gatekeeper) */
    organizationId: text().notNull(),
    /** Workflow that owns this gate */
    workflowId: uuid()
      .notNull()
      .references(() => workflowTable.id, { onDelete: "cascade" }),
    /** Engine run identifier */
    runId: text().notNull(),
    /** Step within the run that created this gate */
    stepId: text().notNull(),
    /** Gate flavour: approval, signal, or manual */
    gateType: text().notNull(),
    /** Human-readable title shown in the approval UI */
    title: text(),
    /** User IDs allowed to approve/reject */
    approvers: jsonb().$type<string[]>(),
    /** Current decision state */
    status: text().default("pending").notNull(),
    /** User ID that made the decision */
    decidedBy: text(),
    /** Freeform reason attached to the decision */
    reason: text(),
    /** For signal gates: expected signal name */
    signalName: text(),
    /** For signal gates: payload received with the signal */
    signalData: jsonb(),
    /** Maximum wait time in milliseconds from creation */
    timeoutMs: text(),
    /** What to do when the timeout elapses */
    timeoutAction: text().default("reject"),
    createdAt: generateDefaultDate(),
    /** When the decision was recorded */
    decidedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index("approval_request_org_idx").on(table.organizationId),
    index("approval_request_run_step_idx").on(table.runId, table.stepId),
    index("approval_request_status_idx").on(table.status),
    organizationRlsPolicy(),
  ],
);

// Relations are defined in relations.ts to avoid circular imports
