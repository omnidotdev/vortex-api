/**
 * Plan limit enforcement helpers.
 *
 * Used by authorization plugins to gate resource creation against Aether
 * entitlements. Falls back to permissive (-1) when Aether is unreachable
 * so misconfigured or self-hosted environments are never blocked.
 */

import { getEntitlements } from "lib/aether/client";

/**
 * Get the numeric plan limit for a feature key.
 *
 * Returns -1 for unlimited. When Aether is unreachable or the feature key
 * has no entitlement, returns -1 (permissive fallback).
 */
export const getPlanLimit = async (
  organizationId: string,
  featureKey: string,
): Promise<number> => {
  const result = await getEntitlements("organization", organizationId, "vortex");
  if (!result) return -1;

  const ent = result.entitlements.find((e) => e.featureKey === featureKey);
  if (!ent || ent.value === null) return -1;

  return Number(ent.value);
};

/**
 * Check whether a boolean feature flag is enabled.
 *
 * Returns true when Aether is unreachable (permissive fallback).
 */
export const isFeatureEnabled = async (
  organizationId: string,
  featureKey: string,
): Promise<boolean> => {
  const result = await getEntitlements("organization", organizationId, "vortex");
  if (!result) return true;

  const ent = result.entitlements.find((e) => e.featureKey === featureKey);
  if (!ent || ent.value === null) return false;

  return ent.value === "true" || ent.value === "1";
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
