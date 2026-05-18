import { EXPORTABLE } from "graphile-export";
import { SafeError, context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import { FEATURE_KEYS } from "lib/entitlements/constants";
import { assertUnderLimit, getPlanLimit } from "lib/entitlements/enforce";
import authorize from "lib/warden/authorize";

import type { PlanWrapperFn } from "postgraphile/utils";
import type { MutationScope } from "./types";

/**
 * Validate plugin permissions via Warden.
 *
 * - Create: Admin+ can add plugins (plan limit enforced)
 * - Update: Admin+ can update plugin config
 * - Delete: Admin+ can remove plugins
 */
const validatePermissions = (propName: string, scope: MutationScope) =>
  EXPORTABLE(
    (
      SafeError,
      context,
      sideEffect,
      propName,
      scope,
      getPlanLimit,
      assertUnderLimit,
      FEATURE_KEYS,
      authorize,
    ): PlanWrapperFn =>
      (plan, _, fieldArgs) => {
        const $input = fieldArgs.getRaw(["input", propName]) as any;
        const $observer = context().get("observer");
        const $db = context().get("db");

        sideEffect(
          [$input, $observer, $db],
          async ([input, observer, db]: readonly any[]) => {
            if (!observer) throw new SafeError("Unauthorized");

            if (scope === "create") {
              const organizationId = input.organizationId;

              const allowed = await authorize(
                observer.identityProviderId,
                "organization",
                organizationId,
                "admin",
              );
              if (!allowed) throw new SafeError("Unauthorized");

              // Enforce plugin count limit
              const [limit, existing] = await Promise.all([
                getPlanLimit(organizationId, FEATURE_KEYS.MAX_PLUGINS),
                db.query.pluginTable.findMany({
                  where: (table: any, { eq }: any) =>
                    eq(table.organizationId, organizationId),
                  columns: { id: true },
                }),
              ]);
              assertUnderLimit(limit, existing.length, "plugins");
            } else {
              const plugin = await db.query.pluginTable.findFirst({
                where: (table: any, { eq }: any) => eq(table.id, input),
              });

              if (!plugin) throw new SafeError("Plugin not found");

              const allowed = await authorize(
                observer.identityProviderId,
                "organization",
                plugin.organizationId,
                "admin",
              );
              if (!allowed) throw new SafeError("Unauthorized");
            }
          },
        );

        return plan();
      },
    [
      SafeError,
      context,
      sideEffect,
      propName,
      scope,
      getPlanLimit,
      assertUnderLimit,
      FEATURE_KEYS,
      authorize,
    ],
  );

/**
 * Authorization plugin for Extism plugins.
 *
 * - Create: Admin+ role required; plan limit enforced
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
