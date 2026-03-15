import { EXPORTABLE } from "graphile-export";
import { SafeError, context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import { FEATURE_KEYS } from "lib/entitlements/constants";
import { assertUnderLimit, getPlanLimit } from "lib/entitlements/enforce";

import type { PlanWrapperFn } from "postgraphile/utils";
import type { MutationScope } from "./types";

/**
 * Validate integration permissions.
 *
 * - Create: Admin+ can add integrations (subject to plan limit)
 * - Update: Admin+ can update integration config
 * - Delete: Admin+ can remove integrations
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
    ): PlanWrapperFn =>
      (plan, _, fieldArgs) => {
        const $input = fieldArgs.getRaw(["input", propName]);
        const $observer = context().get("observer");
        const $db = context().get("db");

        sideEffect([$input, $observer, $db], async ([input, observer, db]) => {
          if (!observer) throw new SafeError("Unauthorized");

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

            if (!membership) throw new SafeError("Unauthorized");
            if (membership.role === "member")
              throw new SafeError("Unauthorized");

            // Enforce plan limit
            const [limit, existing] = await Promise.all([
              getPlanLimit(organizationId, FEATURE_KEYS.MAX_INTEGRATIONS),
              db.query.integrationTable.findMany({
                where: (table, { eq }) =>
                  eq(table.organizationId, organizationId),
                columns: { id: true },
              }),
            ]);
            assertUnderLimit(limit, existing.length, "integrations");
          } else {
            // Update/delete: verify organization membership and admin+ role
            const integration = await db.query.integrationTable.findFirst({
              where: (table, { eq }) => eq(table.id, input),
            });

            if (!integration) throw new SafeError("Integration not found");

            const membership = await db.query.userOrganizationTable.findFirst({
              where: (table, { and, eq }) =>
                and(
                  eq(table.userId, observer.id),
                  eq(table.organizationId, integration.organizationId),
                ),
            });

            if (!membership) throw new SafeError("Unauthorized");
            if (membership.role === "member")
              throw new SafeError("Unauthorized");
          }
        });

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
    ],
  );

/**
 * Authorization plugin for integrations.
 *
 * - Create: Admin+ role required (plan limit enforced)
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
