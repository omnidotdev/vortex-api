import { EXPORTABLE } from "graphile-export";
import { SafeError, context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import { FEATURE_KEYS } from "lib/entitlements/constants";
import { checkFeatureEnabled } from "lib/entitlements/enforce";
import authorize from "lib/warden/authorize";

import type { PlanWrapperFn } from "postgraphile/utils";

/**
 * Validate audit log access.
 *
 * Require authentication, member relation on at least one of the caller's
 * organizations (via Warden), and the `audit_logs` entitlement
 * for that organization before returning event log data.
 */
const validateAuditLogAccess = (): PlanWrapperFn =>
  EXPORTABLE(
    (
      SafeError,
      context,
      sideEffect,
      checkFeatureEnabled,
      FEATURE_KEYS,
      authorize,
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

            // Warden membership check across the caller's orgs
            const membershipResults = await Promise.all(
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

            const memberOrgIds = (organizationIds as string[]).filter(
              (_, idx) => membershipResults[idx],
            );

            if (memberOrgIds.length === 0) {
              throw new SafeError("Unauthorized");
            }

            // Check if any of the user's member organizations have audit logs enabled
            const results = await Promise.all(
              memberOrgIds.map((orgId: string) =>
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
    [
      SafeError,
      context,
      sideEffect,
      checkFeatureEnabled,
      FEATURE_KEYS,
      authorize,
    ],
  );

/**
 * Authorization plugin for event logs (audit logs).
 *
 * Gates read access behind a Warden `member` check and the `audit_logs`
 * entitlement. Event logs are read-only at the GraphQL layer; writes
 * happen internally via the event publishing pipeline.
 */
const EventLogPlugin = wrapPlans({
  Query: {
    eventLogs: validateAuditLogAccess(),
    eventLog: validateAuditLogAccess(),
    eventLogById: validateAuditLogAccess(),
  },
});

export default EventLogPlugin;
