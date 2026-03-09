/**
 * Plan limit enforcement helpers.
 *
 * Used by authorization plugins to gate resource creation against Aether
 * entitlements. Falls back to permissive (-1) when Aether is unreachable
 * so misconfigured or self-hosted environments are never blocked.
 */

import { getEntitlements } from "lib/aether/client";
import { isDevEnv, isSelfHosted } from "lib/config/env.config";

/**
 * Get the numeric plan limit for a feature key.
 *
 * Returns -1 for unlimited. When Aether is unreachable in production,
 * returns 0 (fail-closed). Self-hosted and dev environments fall back
 * to -1 (permissive)
 */
export const getPlanLimit = async (
  organizationId: string,
  featureKey: string,
): Promise<number> => {
  const result = await getEntitlements(
    "organization",
    organizationId,
    "vortex",
  );
  if (!result) return isSelfHosted || isDevEnv ? -1 : 0;

  const ent = result.entitlements.find((e) => e.featureKey === featureKey);
  if (!ent || ent.value === null) return -1;

  return Number(ent.value);
};

/**
 * Check whether a boolean feature is enabled for an organization.
 *
 * Returns false (deny) when Aether is unreachable in production.
 * Self-hosted and dev environments fall back to true (permissive)
 */
export const checkFeatureEnabled = async (
  organizationId: string,
  featureKey: string,
): Promise<boolean> => {
  const result = await getEntitlements(
    "organization",
    organizationId,
    "vortex",
  );
  if (!result) return isSelfHosted || isDevEnv;

  const ent = result.entitlements.find((e) => e.featureKey === featureKey);
  if (!ent || ent.value === null) return false;

  return ent.value === "true";
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
    throw new Error(
      `Plan limit reached: ${resource} (${count}/${limit}). Upgrade your plan to continue.`,
    );
  }
};
