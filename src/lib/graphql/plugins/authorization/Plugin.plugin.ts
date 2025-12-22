import { EXPORTABLE } from "graphile-export";
import { context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import { BASIC_TIER_MAX_PLUGINS, FREE_TIER_MAX_PLUGINS } from "./constants";

import type { PlanWrapperFn } from "postgraphile/utils";
import type { MutationScope } from "./types";

/**
 * Validate plugin permissions.
 *
 * - Create: Admin+ can add plugins (subject to tier limits)
 * - Update: Admin+ can update plugin config
 * - Delete: Admin+ can remove plugins
 */
const validatePermissions = (propName: string, scope: MutationScope) =>
  EXPORTABLE(
    (
      context,
      sideEffect,
      FREE_TIER_MAX_PLUGINS,
      BASIC_TIER_MAX_PLUGINS,
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
                plugins: true,
              },
            });

            if (!workspace?.workspaceUsers.length)
              throw new Error("Unauthorized");

            const role = workspace.workspaceUsers[0].role;
            if (role === "member") throw new Error("Unauthorized");

            // Check tier limits
            const pluginCount = workspace.plugins.length;
            const maxPlugins =
              workspace.tier === "free"
                ? FREE_TIER_MAX_PLUGINS
                : workspace.tier === "basic"
                  ? BASIC_TIER_MAX_PLUGINS
                  : Infinity;

            if (pluginCount >= maxPlugins)
              throw new Error("Maximum plugins reached for your plan");
          } else {
            // Update/delete: verify workspace membership and admin+ role
            const plugin = await db.query.pluginTable.findFirst({
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

            if (!plugin?.workspace.workspaceUsers.length)
              throw new Error("Unauthorized");

            const role = plugin.workspace.workspaceUsers[0].role;
            if (role === "member") throw new Error("Unauthorized");
          }
        });

        return plan();
      },
    [
      context,
      sideEffect,
      FREE_TIER_MAX_PLUGINS,
      BASIC_TIER_MAX_PLUGINS,
      propName,
      scope,
    ],
  );

/**
 * Authorization plugin for Extism plugins.
 *
 * - Create: Admin+ role required (subject to tier limits)
 * - Update: Admin+ role required
 * - Delete: Admin+ role required
 */
const PluginPlugin = wrapPlans({
  Mutation: {
    createPlugin: validatePermissions("plugin", "create"),
    updatePlugin: validatePermissions("rowId", "update"),
    deletePlugin: validatePermissions("rowId", "delete"),
  },
});

export default PluginPlugin;
