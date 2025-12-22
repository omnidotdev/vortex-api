import { EXPORTABLE } from "graphile-export";
import { context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import { BASIC_TIER_MAX_WORKFLOWS, FREE_TIER_MAX_WORKFLOWS } from "./constants";

import type { PlanWrapperFn } from "postgraphile/utils";
import type { MutationScope } from "./types";

/**
 * Validate workflow permissions.
 *
 * - Create: Any workspace member can create (subject to tier limits)
 * - Update: Admin+ can update workflows
 * - Delete: Admin+ can delete workflows
 */
const validatePermissions = (propName: string, scope: MutationScope) =>
  EXPORTABLE(
    (
      context,
      sideEffect,
      FREE_TIER_MAX_WORKFLOWS,
      BASIC_TIER_MAX_WORKFLOWS,
      propName,
      scope,
    ): PlanWrapperFn =>
      (plan, _, fieldArgs) => {
        const $input = fieldArgs.getRaw(["input", propName]);
        const $observer = context().get("observer");
        const $db = context().get("db");

        sideEffect([$input, $observer, $db], async ([input, observer, db]) => {
          if (!observer) throw new Error("Unauthorized");

          if (scope === "create") {
            const workspaceId = input.workspaceId;

            // Verify workspace membership
            const workspace = await db.query.workspaceTable.findFirst({
              where: (table, { eq }) => eq(table.id, workspaceId),
              with: {
                workspaceUsers: {
                  where: (table, { eq }) => eq(table.userId, observer.id),
                },
                workflows: true,
              },
            });

            if (!workspace?.workspaceUsers.length)
              throw new Error("Unauthorized");

            // Check tier limits
            const workflowCount = workspace.workflows.length;
            const maxWorkflows =
              workspace.tier === "free"
                ? FREE_TIER_MAX_WORKFLOWS
                : workspace.tier === "basic"
                  ? BASIC_TIER_MAX_WORKFLOWS
                  : Infinity;

            if (workflowCount >= maxWorkflows)
              throw new Error("Maximum workflows reached for your plan");
          } else {
            // Update/delete: verify workspace membership and admin+ role
            const workflow = await db.query.workflowTable.findFirst({
              where: (table, { eq }) => eq(table.id, input),
              with: {
                workspace: {
                  with: {
                    workspaceUsers: {
                      where: (table, { eq }) => eq(table.userId, observer.id),
                    },
                  },
                },
              },
            });

            if (!workflow?.workspace.workspaceUsers.length)
              throw new Error("Unauthorized");

            // Only admin+ can modify workflows
            const role = workflow.workspace.workspaceUsers[0].role;
            if (role === "member") throw new Error("Unauthorized");
          }
        });

        return plan();
      },
    [
      context,
      sideEffect,
      FREE_TIER_MAX_WORKFLOWS,
      BASIC_TIER_MAX_WORKFLOWS,
      propName,
      scope,
    ],
  );

/**
 * Authorization plugin for workflows.
 *
 * - Create: Any workspace member (subject to tier limits)
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
