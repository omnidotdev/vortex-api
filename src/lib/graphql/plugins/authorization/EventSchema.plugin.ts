import { EXPORTABLE } from "graphile-export";
import { context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import type { PlanWrapperFn } from "postgraphile/utils";

/**
 * Validate event schema permissions.
 *
 * Event schemas are global catalog entries (no organizationId).
 * All mutations require authentication.
 */
const validatePermissions = (propName: string) =>
  EXPORTABLE(
    (context, sideEffect, propName): PlanWrapperFn =>
      (plan, _, fieldArgs) => {
        const $input = fieldArgs.getRaw(["input", propName]);
        const $observer = context().get("observer");

        sideEffect([$input, $observer], async ([_input, observer]) => {
          if (!observer) throw new Error("Unauthorized");
        });

        return plan();
      },
    [context, sideEffect, propName],
  );

/**
 * Authorization plugin for event schemas.
 *
 * Requires authentication for all mutations.
 */
const EventSchemaPlugin = wrapPlans({
  Mutation: {
    createEventSchema: validatePermissions("eventSchema"),
    updateEventSchema: validatePermissions("rowId"),
    deleteEventSchema: validatePermissions("rowId"),
  },
});

export default EventSchemaPlugin;
