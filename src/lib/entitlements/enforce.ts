/**
 * Plan limit enforcement helpers.
 *
 * Used by authorization plugins to gate resource creation against Aether
 * entitlements. Falls back to permissive (-1) when Aether is unreachable
 * so misconfigured or self-hosted environments are never blocked.
 */

import { SafeError } from "postgraphile/grafast";

import { getEntitlements } from "lib/aether/client";
import { isDevEnv, isSelfHosted } from "lib/config/env.config";

/**
 * Get the numeric plan limit for a feature key.
 *
 * Returns -1 for unlimited. When Aether is unreachable, falls back to
 * -1 (permissive) so transient outages never block users
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
  if (!result) return -1;

  const ent = result.entitlements.find((e) => e.featureKey === featureKey);
  if (!ent || ent.value === null) return -1;

  return Number(ent.value);
};

/**
 * Check whether a boolean feature is enabled for an organization.
 *
 * When Aether is unreachable, falls back to true (permissive) so
 * transient outages never block users
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
  if (!result) return true;

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
    throw new SafeError(
      `Plan limit reached: ${resource} (${count}/${limit}). Upgrade your plan to continue.`,
    );
  }
};
