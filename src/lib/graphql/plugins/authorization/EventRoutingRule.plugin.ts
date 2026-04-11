import { EXPORTABLE } from "graphile-export";
import { SafeError, context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import { FEATURE_KEYS } from "lib/entitlements/constants";
import { assertUnderLimit, getPlanLimit } from "lib/entitlements/enforce";

import type { PlanWrapperFn } from "postgraphile/utils";
import type { MutationScope } from "./types";

/**
 * Validate event routing rule permissions.
 *
 * - Create: Admin+ can add routing rules (subject to plan limit)
 * - Update: Admin+ can update routing rules
 * - Delete: Admin+ can remove routing rules
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
        const $input = fieldArgs.getRaw(["input", propName]) as any;
        const $observer = context().get("observer");
        const $db = context().get("db");

        sideEffect([$input, $observer, $db], async ([input, observer, db]: readonly any[]) => {
          if (!observer) throw new SafeError("Unauthorized");

          if (scope === "create") {
            const organizationId = input.organizationId;

            // Verify organization membership and admin+ role
            const membership = await db.query.userOrganizationTable.findFirst({
              where: (table: any, { and, eq }: any) =>
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
              getPlanLimit(organizationId, FEATURE_KEYS.MAX_ROUTING_RULES),
              db.query.eventRoutingRuleTable.findMany({
                where: (table: any, { eq }: any) =>
                  eq(table.organizationId, organizationId),
                columns: { id: true },
              }),
            ]);
            assertUnderLimit(limit, existing.length, "routing rules");
          } else {
            // Update/delete: verify organization membership and admin+ role
            const rule = await db.query.eventRoutingRuleTable.findFirst({
              where: (table: any, { eq }: any) => eq(table.id, input),
            });

            if (!rule) throw new SafeError("Event routing rule not found");

            const membership = await db.query.userOrganizationTable.findFirst({
              where: (table: any, { and, eq }: any) =>
                and(
                  eq(table.userId, observer.id),
                  eq(table.organizationId, rule.organizationId),
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
 * Authorization plugin for event routing rules.
 *
 * - Create: Admin+ role required (plan limit enforced)
 * - Update: Admin+ role required
 * - Delete: Admin+ role required
 */
const EventRoutingRulePlugin = wrapPlans({
  Mutation: {
    createEventRoutingRule: validatePermissions("eventRoutingRule", "create"),
    updateEventRoutingRule: validatePermissions("rowId", "update"),
    deleteEventRoutingRule: validatePermissions("rowId", "delete"),
  },
});

export default EventRoutingRulePlugin;
