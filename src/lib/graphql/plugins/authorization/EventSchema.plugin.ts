import { EXPORTABLE } from "graphile-export";
import { SafeError, context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import type { PlanWrapperFn } from "postgraphile/utils";
import type { MutationScope } from "./types";

/**
 * Validate event schema permissions.
 *
 * - Create: Admin+ in the target organization
 * - Update/Delete: Admin+ in the schema's owning organization
 */
const validatePermissions = (propName: string, scope: MutationScope) =>
  EXPORTABLE(
    (SafeError, context, sideEffect, propName, scope): PlanWrapperFn =>
      (plan, _, fieldArgs) => {
        const $input = fieldArgs.getRaw(["input", propName]);
        const $observer = context().get("observer");
        const $db = context().get("db");

        sideEffect([$input, $observer, $db], async ([input, observer, db]) => {
          if (!observer) throw new SafeError("Unauthorized");

          if (scope === "create") {
            const organizationId = input.organizationId;

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
          } else {
            const schema = await db.query.eventSchemaTable.findFirst({
              where: (table, { eq }) => eq(table.id, input),
            });

            if (!schema) throw new SafeError("Event schema not found");

            const membership = await db.query.userOrganizationTable.findFirst({
              where: (table, { and, eq }) =>
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
    [SafeError, context, sideEffect, propName, scope],
  );

/**
 * Authorization plugin for event schemas.
 *
 * Requires admin+ role in the target organization for all mutations
 */
const EventSchemaPlugin = wrapPlans({
  Mutation: {
    createEventSchema: validatePermissions("eventSchema", "create"),
    updateEventSchema: validatePermissions("rowId", "update"),
    deleteEventSchema: validatePermissions("rowId", "delete"),
  },
});

export default EventSchemaPlugin;
