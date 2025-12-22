import { EXPORTABLE } from "graphile-export";
import { context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import {
  BASIC_TIER_MAX_INTEGRATIONS,
  FREE_TIER_MAX_INTEGRATIONS,
} from "./constants";

import type { PlanWrapperFn } from "postgraphile/utils";
import type { MutationScope } from "./types";

/**
 * Validate integration permissions.
 *
 * - Create: Admin+ can add integrations (subject to tier limits)
 * - Update: Admin+ can update integration config
 * - Delete: Admin+ can remove integrations
 */
const validatePermissions = (propName: string, scope: MutationScope) =>
  EXPORTABLE(
    (
      context,
      sideEffect,
      FREE_TIER_MAX_INTEGRATIONS,
      BASIC_TIER_MAX_INTEGRATIONS,
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

            // Verify workspace membership and admin+ role
            const workspace = await db.query.workspaceTable.findFirst({
              where: (table, { eq }) => eq(table.id, workspaceId),
              with: {
                workspaceUsers: {
                  where: (table, { eq }) => eq(table.userId, observer.id),
                },
                integrations: true,
              },
            });

            if (!workspace?.workspaceUsers.length)
              throw new Error("Unauthorized");

            const role = workspace.workspaceUsers[0].role;
            if (role === "member") throw new Error("Unauthorized");

            // Check tier limits
            const integrationCount = workspace.integrations.length;
            const maxIntegrations =
              workspace.tier === "free"
                ? FREE_TIER_MAX_INTEGRATIONS
                : workspace.tier === "basic"
                  ? BASIC_TIER_MAX_INTEGRATIONS
                  : Infinity;

            if (integrationCount >= maxIntegrations)
              throw new Error("Maximum integrations reached for your plan");
          } else {
            // Update/delete: verify workspace membership and admin+ role
            const integration = await db.query.integrationTable.findFirst({
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

            if (!integration?.workspace.workspaceUsers.length)
              throw new Error("Unauthorized");

            const role = integration.workspace.workspaceUsers[0].role;
            if (role === "member") throw new Error("Unauthorized");
          }
        });

        return plan();
      },
    [
      context,
      sideEffect,
      FREE_TIER_MAX_INTEGRATIONS,
      BASIC_TIER_MAX_INTEGRATIONS,
      propName,
      scope,
    ],
  );

/**
 * Authorization plugin for integrations.
 *
 * - Create: Admin+ role required (subject to tier limits)
 * - Update: Admin+ role required
 * - Delete: Admin+ role required
 */
const IntegrationPlugin = wrapPlans({
  Mutation: {
    createIntegration: validatePermissions("integration", "create"),
    updateIntegration: validatePermissions("rowId", "update"),
    deleteIntegration: validatePermissions("rowId", "delete"),
  },
});

export default IntegrationPlugin;
