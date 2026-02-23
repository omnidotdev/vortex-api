import { EXPORTABLE } from "graphile-export";
import { context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import type { PlanWrapperFn } from "postgraphile/utils";

/**
 * Validate dead letter event permissions.
 *
 * Read: Any authenticated organization member can view DLQ events for their organization
 */
const validateReadPermissions = (): PlanWrapperFn =>
  EXPORTABLE(
    (context, sideEffect): PlanWrapperFn =>
      (plan) => {
        const $observer = context().get("observer");

        sideEffect([$observer], async ([observer]) => {
          if (!observer) throw new Error("Unauthorized");
        });

        return plan();
      },
    [context, sideEffect],
  );

/**
 * Authorization plugin for dead letter events.
 *
 * Enforces organization-scoped read access via authorization middleware
 * in createGraphqlContext. The DLQ is read-only at the GraphQL layer;
 * mutations (replay, discard) are handled via REST endpoints.
 */
const DeadLetterEventPlugin = wrapPlans({
  Query: {
    deadLetterEvents: validateReadPermissions(),
    deadLetterEvent: validateReadPermissions(),
  },
});

export default DeadLetterEventPlugin;
