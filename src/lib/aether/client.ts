import { AETHER_BASE_URL, isSelfHosted } from "lib/config/env.config";

import type { EntitlementsResponse } from "./types";

/**
 * Vortex feature keys for entitlements.
 */
export const FEATURE_KEYS = {
  TIER: "tier",
  MAX_WORKFLOWS: "max_workflows",
  MAX_RUNS_PER_MONTH: "max_runs_per_month",
  MAX_INTEGRATIONS: "max_integrations",
  MAX_PLUGINS: "max_plugins",
  MAX_USERS: "max_users",
  SSO_ENABLED: "sso_enabled",
  AUDIT_LOGS: "audit_logs",
  CUSTOM_PLUGINS: "custom_plugins",
} as const;

/**
 * Default entitlements for self-hosted mode (all features unlocked).
 * Uses minimal Entitlement shape with required fields.
 */
const SELF_HOSTED_ENTITLEMENTS: EntitlementsResponse = {
  billingAccountId: "self-hosted",
  entityType: "organization",
  entityId: "self-hosted",
  entitlementVersion: 1,
  entitlements: [
    {
      id: "sh-1",
      featureKey: FEATURE_KEYS.TIER,
      value: "enterprise",
      productId: "vortex",
      source: "self-hosted",
      validFrom: "2020-01-01T00:00:00Z",
      validUntil: null,
    },
    {
      id: "sh-2",
      featureKey: FEATURE_KEYS.MAX_WORKFLOWS,
      value: "-1",
      productId: "vortex",
      source: "self-hosted",
      validFrom: "2020-01-01T00:00:00Z",
      validUntil: null,
    },
    {
      id: "sh-3",
      featureKey: FEATURE_KEYS.MAX_RUNS_PER_MONTH,
      value: "-1",
      productId: "vortex",
      source: "self-hosted",
      validFrom: "2020-01-01T00:00:00Z",
      validUntil: null,
    },
    {
      id: "sh-4",
      featureKey: FEATURE_KEYS.MAX_INTEGRATIONS,
      value: "-1",
      productId: "vortex",
      source: "self-hosted",
      validFrom: "2020-01-01T00:00:00Z",
      validUntil: null,
    },
    {
      id: "sh-5",
      featureKey: FEATURE_KEYS.MAX_PLUGINS,
      value: "-1",
      productId: "vortex",
      source: "self-hosted",
      validFrom: "2020-01-01T00:00:00Z",
      validUntil: null,
    },
    {
      id: "sh-6",
      featureKey: FEATURE_KEYS.MAX_USERS,
      value: "-1",
      productId: "vortex",
      source: "self-hosted",
      validFrom: "2020-01-01T00:00:00Z",
      validUntil: null,
    },
    {
      id: "sh-7",
      featureKey: FEATURE_KEYS.SSO_ENABLED,
      value: "true",
      productId: "vortex",
      source: "self-hosted",
      validFrom: "2020-01-01T00:00:00Z",
      validUntil: null,
    },
    {
      id: "sh-8",
      featureKey: FEATURE_KEYS.AUDIT_LOGS,
      value: "true",
      productId: "vortex",
      source: "self-hosted",
      validFrom: "2020-01-01T00:00:00Z",
      validUntil: null,
    },
    {
      id: "sh-9",
      featureKey: FEATURE_KEYS.CUSTOM_PLUGINS,
      value: "true",
      productId: "vortex",
      source: "self-hosted",
      validFrom: "2020-01-01T00:00:00Z",
      validUntil: null,
    },
  ],
};

/**
 * Get all entitlements for an entity.
 * Optionally filter by product.
 *
 * Returns null if AETHER_BASE_URL is not configured.
 */
export const getEntitlements = async (
  entityType: string,
  entityId: string,
  productId?: string,
): Promise<EntitlementsResponse | null> => {
  // Self-hosted mode: return all features unlocked
  if (isSelfHosted) {
    return SELF_HOSTED_ENTITLEMENTS;
  }

  if (!AETHER_BASE_URL) {
    return null;
  }

  try {
    const url = new URL(
      `${AETHER_BASE_URL}/entitlements/${entityType}/${entityId}`,
    );
    if (productId) {
      url.searchParams.set("productId", productId);
    }

    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });

    if (!res.ok) {
      return null;
    }

    return res.json();
  } catch {
    return null;
  }
};

/**
 * Check if an entity has a specific entitlement.
 * Returns the entitlement value if found, null otherwise.
 */
export const checkEntitlement = async (
  entityType: string,
  entityId: string,
  productId: string,
  featureKey: string,
): Promise<string | null> => {
  const entitlements = await getEntitlements(entityType, entityId, productId);

  if (!entitlements) {
    return null;
  }

  const entitlement = entitlements.entitlements.find(
    (e) => e.featureKey === featureKey,
  );

  return entitlement?.value ?? null;
};
