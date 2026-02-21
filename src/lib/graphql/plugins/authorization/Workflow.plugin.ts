import { EXPORTABLE } from "graphile-export";
import { context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import { FEATURE_KEYS } from "lib/aether/client";
import { assertUnderLimit, getPlanLimit } from "lib/entitlements/enforce";

import type { PlanWrapperFn } from "postgraphile/utils";
import type { MutationScope } from "./types";

/**
 * Validate workflow permissions.
 *
 * - Create: Any organization member can create (subject to plan limit)
 * - Update: Admin+ can update workflows
 * - Delete: Admin+ can delete workflows
 */
const validatePermissions = (propName: string, scope: MutationScope) =>
  EXPORTABLE(
    (
      context,
      sideEffect,
      propName,
      scope,
      getPlanLimit,
      assertUnderLimit,
      FEATURE_KEYS,
    ): PlanWrapperFn =>
      (plan, _, fieldArgs) => {
        const $input = fieldArgs.getRaw(["input", propName]);
        const $observer = context().get("observer");
        const $db = context().get("db");

        sideEffect([$input, $observer, $db], async ([input, observer, db]) => {
          if (!observer) throw new Error("Unauthorized");

          if (scope === "create") {
            const organizationId = input.organizationId;

            // Verify organization membership
            const membership = await db.query.userOrganizationTable.findFirst({
              where: (table, { and, eq }) =>
                and(
                  eq(table.userId, observer.id),
                  eq(table.organizationId, organizationId),
                ),
            });

            if (!membership) throw new Error("Unauthorized");

            // Enforce plan limit
            const [limit, existing] = await Promise.all([
              getPlanLimit(organizationId, FEATURE_KEYS.MAX_WORKFLOWS),
              db.query.workflowTable.findMany({
                where: (table, { eq }) =>
                  eq(table.organizationId, organizationId),
                columns: { id: true },
              }),
            ]);
            assertUnderLimit(limit, existing.length, "workflows");
          } else {
            // Update/delete: verify organization membership and admin+ role
            const workflow = await db.query.workflowTable.findFirst({
              where: (table, { eq }) => eq(table.id, input),
            });

            if (!workflow) throw new Error("Workflow not found");

            const membership = await db.query.userOrganizationTable.findFirst({
              where: (table, { and, eq }) =>
                and(
                  eq(table.userId, observer.id),
                  eq(table.organizationId, workflow.organizationId),
                ),
            });

            if (!membership) throw new Error("Unauthorized");

            // Only admin+ can modify workflows
            if (membership.role === "member") throw new Error("Unauthorized");
          }
        });

        return plan();
      },
    [
      context,
      sideEffect,
      propName,
      scope,
      getPlanLimit,
      assertUnderLimit,
      FEATURE_KEYS,
    ],
  );

/**
 * Authorization plugin for workflows.
 *
 * - Create: Any organization member (plan limit enforced)
 * - Update: Admin+ role required
 * - Delete: Admin+ role required
 */
const WorkflowPlugin = wrapPlans({
  Mutation: {
    createWorkflow: validatePermissions("workflow", "create"),
    updateWorkflow: validatePermissions("rowId", "update"),
    deleteWorkflow: validatePermissions("rowId", "delete"),
  },
});

export default WorkflowPlugin;
