import { EXPORTABLE } from "graphile-export";
import { SafeError, context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import authorize from "lib/warden/authorize";

import type { PlanWrapperFn } from "postgraphile/utils";

/**
 * Validate dead letter event read permissions via Warden.
 *
 * Requires `member` relation on at least one of the caller's organizations.
 * Organization-level scoping (which DLQ rows are returned) is enforced
 * by the OrganizationScopePlugin via the `app.organization_ids` setting.
 */
const validateReadPermissions = (): PlanWrapperFn =>
  EXPORTABLE(
    (SafeError, context, sideEffect, authorize): PlanWrapperFn =>
      (plan) => {
        const $observer = context().get("observer");
        const $organizationIds = context().get("organizationIds");

        sideEffect(
          [$observer, $organizationIds],
          async ([observer, organizationIds]) => {
            if (!observer) throw new SafeError("Unauthorized");

            if (
              !Array.isArray(organizationIds) ||
              organizationIds.length === 0
            ) {
              throw new SafeError("Unauthorized");
            }

            const results = await Promise.all(
              (organizationIds as string[]).map((orgId) =>
                authorize(
                  (observer as { identityProviderId: string })
                    .identityProviderId,
                  "organization",
                  orgId,
                  "member",
                ),
              ),
            );

            if (!results.some(Boolean)) {
              throw new SafeError("Unauthorized");
            }
          },
        );

        return plan();
      },
    [SafeError, context, sideEffect, authorize],
  );

/**
 * Authorization plugin for dead letter events.
 *
 * Enforces organization-scoped read access via Warden membership checks
 * across the caller's organizations. The DLQ is read-only at the GraphQL
 * layer; mutations (replay, discard) are handled via REST endpoints.
 */
const DeadLetterEventPlugin = wrapPlans({
  Query: {
    deadLetterEvents: validateReadPermissions(),
    deadLetterEvent: validateReadPermissions(),
  },
});

export default DeadLetterEventPlugin;
