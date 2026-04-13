/**
 * Entitlements enforcement for Vortex.
 *
 * Thin wrapper around @omnidotdev/providers BillingProvider.
 * When Aether is unavailable or no billing account exists,
 * defaults to free-tier limits instead of failing.
 */

import { isWithinLimit as checkLimit } from "@omnidotdev/providers/billing";
import { and, count, eq, gte } from "drizzle-orm";
import { SafeError } from "postgraphile/grafast";

import { hasBilling } from "lib/config/env.config";
import { dbPool as db } from "lib/db/db";
import { workflowRunTable, workflowTable } from "lib/db/schema";
import { billing } from "lib/providers";
import { FEATURE_KEYS } from "./constants";

import type { EntitlementsResponse } from "@omnidotdev/providers/billing";

/** Vortex app ID for entitlements */
const APP_ID = "vortex";

/**
 * Default free-tier limits applied when no billing account exists.
 * Prevents hard failures for orgs that haven't been provisioned in Aether.
 */
const DEFAULT_LIMITS: Record<string, Record<string, number>> = {
  max_workflows: { free: 5 },
  max_integrations: { free: 10 },
  max_plugins: { free: 2 },
  max_functions: { free: 5 },
  max_subscriptions: { free: 25 },
  max_mcp_servers: { free: 5 },
  max_routing_rules: { free: 10 },
  max_event_schemas: { free: 10 },
  max_executions_per_month: { free: 1000 },
  max_users: { free: 1 },
  audit_logs: { free: 0 },
  custom_plugins: { free: 0 },
  sso_enabled: { free: 0 },
};

/** Tier type */
type Tier = "free" | "starter" | "pro" | "team" | "enterprise";

/**
 * Fetch entitlements for an organization from the billing provider.
 */
async function getOrganizationEntitlements(
  organizationId: string,
): Promise<EntitlementsResponse | null> {
  return billing.getEntitlements("organization", organizationId, APP_ID);
}

/**
 * Get the numeric plan limit for a feature key.
 *
 * Returns -1 for unlimited. When Aether is unreachable, falls back to
 * free-tier default so transient outages degrade gracefully
 */
export const getPlanLimit = async (
  organizationId: string,
  featureKey: string,
): Promise<number> => {
  // When billing is not configured (self-hosted), all limits are unlimited
  if (!hasBilling) return -1;

  let value: string | null;

  try {
    value = await billing.checkEntitlement(
      "organization",
      organizationId,
      APP_ID,
      featureKey,
    );
  } catch {
    // Aether unreachable, fall back to free-tier default
    const freeDefault = DEFAULT_LIMITS[featureKey]?.free;
    return freeDefault ?? -1;
  }

  if (value === null) {
    // No billing account, fall back to free-tier default
    const freeDefault = DEFAULT_LIMITS[featureKey]?.free;
    return freeDefault ?? -1;
  }

  const num = Number(value);
  return Number.isNaN(num) ? -1 : num;
};

/**
 * Check whether a boolean feature is enabled for an organization.
 *
 * When Aether is unreachable, falls back to free-tier default
 */
export const checkFeatureEnabled = async (
  organizationId: string,
  featureKey: string,
): Promise<boolean> => {
  // When billing is not configured (self-hosted), all features are enabled
  if (!hasBilling) return true;

  let value: string | null;

  try {
    value = await billing.checkEntitlement(
      "organization",
      organizationId,
      APP_ID,
      featureKey,
    );
  } catch {
    // Aether unreachable, fall back to free-tier default
    const freeDefault = DEFAULT_LIMITS[featureKey]?.free;
    return freeDefault !== undefined && freeDefault > 0;
  }

  if (value === null) {
    const freeDefault = DEFAULT_LIMITS[featureKey]?.free;
    return freeDefault !== undefined && freeDefault > 0;
  }

  return value === "true" || value === "1" || Number(value) > 0;
};

/**
 * Throw if the current count has reached the plan limit.
 * Passes through immediately when limit is -1 (unlimited).
 */
export const assertUnderLimit = (
  limit: number,
  count: number,
  resource: string,
): void => {
  if (limit === -1) return;
  if (count >= limit) {
    throw new SafeError(
      `Plan limit reached: ${resource} (${count}/${limit}). Upgrade your plan to continue.`,
    );
  }
};

/**
 * Check if an organization is within its limit for a resource.
 *
 * @param entity - Object with organizationId
 * @param limitKey - The limit key to check (e.g., "max_workflows")
 * @param currentCount - Current count of resources
 * @param billingBypassOrgIds - Organization IDs exempt from billing limits
 * @knipignore Used by plugins
 */
export async function isWithinLimit(
  entity: { organizationId: string },
  limitKey: string,
  currentCount: number,
  billingBypassOrgIds: string[] = [],
): Promise<boolean> {
  // When billing is not configured (self-hosted), all limits are bypassed
  if (!hasBilling) return true;

  // Bypass check for exempt organizations (e.g., Omni internal orgs)
  if (billingBypassOrgIds.includes(entity.organizationId)) {
    return true;
  }

  const entitlements = await getOrganizationEntitlements(entity.organizationId);

  return checkLimit(entitlements, limitKey, currentCount, DEFAULT_LIMITS);
}

/**
 * Check if an organization is within its limit.
 * Lower-level function without bypass logic.
 * @knipignore Used by scripts
 */
export async function checkOrganizationLimit(
  organizationId: string,
  limitKey: string,
  currentCount: number,
): Promise<boolean> {
  if (!hasBilling) return true;

  const entitlements = await getOrganizationEntitlements(organizationId);

  return checkLimit(entitlements, limitKey, currentCount, DEFAULT_LIMITS);
}

/**
 * Get the tier for an organization.
 * Returns "free" if org not found (no billing account yet).
 * @knipignore Used by scripts
 */
export async function getOrganizationTier(
  organizationId: string,
): Promise<Tier> {
  if (!hasBilling) return "enterprise";

  const entitlements = await getOrganizationEntitlements(organizationId);

  if (!entitlements) return "free";

  const tierEntitlement = entitlements.entitlements.find(
    (e) => e.featureKey === `${APP_ID}:tier` || e.featureKey === "tier",
  );

  return (tierEntitlement?.value as Tier) ?? "free";
}

/**
 * Check whether an organization has exceeded its monthly execution limit.
 *
 * @returns `true` when the execution is allowed, `false` when the limit is reached.
 * Fault-tolerant: if Aether is unreachable the execution is allowed so that
 * billing outages don't break webhook triggers.
 */
export async function isExecutionAllowed(
  organizationId: string,
): Promise<boolean> {
  if (!hasBilling) return true;

  try {
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    const [runLimit, runCountResult] = await Promise.all([
      getPlanLimit(organizationId, FEATURE_KEYS.MAX_EXECUTIONS_PER_MONTH),
      db
        .select({ runCount: count() })
        .from(workflowRunTable)
        .innerJoin(
          workflowTable,
          eq(workflowRunTable.workflowId, workflowTable.id),
        )
        .where(
          and(
            eq(workflowTable.organizationId, organizationId),
            gte(workflowRunTable.startedAt, startOfMonth.toISOString()),
          ),
        ),
    ]);

    const runCount = runCountResult[0]?.runCount ?? 0;

    if (runLimit !== -1 && runCount >= runLimit) {
      return false;
    }

    return true;
  } catch {
    return true;
  }
}

/**
 * Invalidate cached entitlements for an organization.
 * Called from webhook handlers when entitlements change.
 */
export function invalidateCache(pattern: string): void {
  // Extract entity info from pattern for provider cache invalidation
  // Patterns: "organization:orgId:*" or "organization:orgId"
  const parts = pattern.replace(/:\*$/, "").split(":");
  if (parts.length >= 2) {
    billing.invalidateCache?.(parts[0], parts[1]);
  } else {
    billing.clearCache?.();
  }
}
