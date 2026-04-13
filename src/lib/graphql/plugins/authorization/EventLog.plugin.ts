import { EXPORTABLE } from "graphile-export";
import { SafeError, context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import { FEATURE_KEYS } from "lib/entitlements/constants";
import { checkFeatureEnabled } from "lib/entitlements/enforce";

import type { PlanWrapperFn } from "postgraphile/utils";

/**
 * Validate audit log access.
 *
 * Require authentication and enforce the `audit_logs` entitlement
 * for the user's primary organization before returning event log data
 */
const validateAuditLogAccess = (): PlanWrapperFn =>
  EXPORTABLE(
    (
      SafeError,
      context,
      sideEffect,
      checkFeatureEnabled,
      FEATURE_KEYS,
    ): PlanWrapperFn =>
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
              throw new SafeError(
                "Audit logs are not available on your current plan",
              );
            }

            // Check if any of the user's organizations have audit logs enabled
            const results = await Promise.all(
              organizationIds.map((orgId: string) =>
                checkFeatureEnabled(orgId, FEATURE_KEYS.AUDIT_LOGS),
              ),
            );

            if (!results.some(Boolean)) {
              throw new SafeError(
                "Audit logs are not available on your current plan",
              );
            }
          },
        );

        return plan();
      },
    [SafeError, context, sideEffect, checkFeatureEnabled, FEATURE_KEYS],
  );

/**
 * Authorization plugin for event logs (audit logs).
 *
 * Gates read access behind the `audit_logs` entitlement.
 * Event logs are read-only at the GraphQL layer; writes happen
 * internally via the event publishing pipeline
 */
const EventLogPlugin = wrapPlans({
  Query: {
    eventLogs: validateAuditLogAccess(),
    eventLog: validateAuditLogAccess(),
    eventLogById: validateAuditLogAccess(),
  },
});

export default EventLogPlugin;
