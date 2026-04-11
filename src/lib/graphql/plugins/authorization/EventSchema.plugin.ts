import { EXPORTABLE } from "graphile-export";
import { SafeError, context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import { FEATURE_KEYS } from "lib/entitlements/constants";
import { assertUnderLimit, getPlanLimit } from "lib/entitlements/enforce";

import type { PlanWrapperFn } from "postgraphile/utils";
import type { MutationScope } from "./types";

/**
 * Validate event schema permissions.
 *
 * - Create: Admin+ in the target organization (subject to plan limit)
 * - Update/Delete: Admin+ in the schema's owning organization
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
              getPlanLimit(organizationId, FEATURE_KEYS.MAX_EVENT_SCHEMAS),
              db.query.eventSchemaTable.findMany({
                where: (table: any, { eq }: any) =>
                  eq(table.organizationId, organizationId),
                columns: { id: true },
              }),
            ]);
            assertUnderLimit(limit, existing.length, "event schemas");
          } else {
            const schema = await db.query.eventSchemaTable.findFirst({
              where: (table: any, { eq }: any) => eq(table.id, input),
            });

            if (!schema) throw new SafeError("Event schema not found");

            const membership = await db.query.userOrganizationTable.findFirst({
              where: (table: any, { and, eq }: any) =>
                and(
                  eq(table.userId, observer.id),
                  eq(table.organizationId, schema.organizationId),
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
 * Authorization plugin for event schemas.
 *
 * Requires admin+ role in the target organization for all mutations.
 * Plan limit enforced on create
 */
const EventSchemaPlugin = wrapPlans({
  Mutation: {
    createEventSchema: validatePermissions("eventSchema", "create"),
    updateEventSchema: validatePermissions("rowId", "update"),
    deleteEventSchema: validatePermissions("rowId", "delete"),
  },
});

export default EventSchemaPlugin;
