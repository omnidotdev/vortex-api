import { EXPORTABLE } from "graphile-export";
import { context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import type { PlanWrapperFn } from "postgraphile/utils";
import type { MutationScope } from "./types";

/**
 * Validate plugin permissions.
 *
 * - Create: Admin+ can add plugins
 * - Update: Admin+ can update plugin config
 * - Delete: Admin+ can remove plugins
 */
const validatePermissions = (propName: string, scope: MutationScope) =>
  EXPORTABLE(
    (context, sideEffect, propName, scope): PlanWrapperFn =>
      (plan, _, fieldArgs) => {
        const $input = fieldArgs.getRaw(["input", propName]);
        const $observer = context().get("observer");
        const $db = context().get("db");

        sideEffect([$input, $observer, $db], async ([input, observer, db]) => {
          if (!observer) throw new Error("Unauthorized");

          if (scope === "create") {
            const organizationId = input.organizationId;

            // Verify organization membership and admin+ role
            const membership = await db.query.userOrganizationTable.findFirst({
              where: (table, { and, eq }) =>
                and(
                  eq(table.userId, observer.id),
                  eq(table.organizationId, organizationId),
                ),
            });

            if (!membership) throw new Error("Unauthorized");
            if (membership.role === "member") throw new Error("Unauthorized");
          } else {
            // Update/delete: verify organization membership and admin+ role
            const plugin = await db.query.pluginTable.findFirst({
              where: (table, { eq }) => eq(table.id, input),
            });

            if (!plugin) throw new Error("Plugin not found");

            const membership = await db.query.userOrganizationTable.findFirst({
              where: (table, { and, eq }) =>
                and(
                  eq(table.userId, observer.id),
                  eq(table.organizationId, plugin.organizationId),
                ),
            });

            if (!membership) throw new Error("Unauthorized");
            if (membership.role === "member") throw new Error("Unauthorized");
          }
        });

        return plan();
      },
    [context, sideEffect, propName, scope],
  );

/**
 * Authorization plugin for Extism plugins.
 *
 * - Create: Admin+ role required
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
