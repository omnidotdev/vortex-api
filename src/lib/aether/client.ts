import { AETHER_BASE_URL, isSelfHosted } from "lib/config/env.config";

import type { EntitlementsResponse } from "./types";

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
      featureKey: "tier",
      value: "enterprise",
      productId: "platform",
      source: "self-hosted",
      validFrom: "2020-01-01T00:00:00Z",
      validUntil: null,
    },
    {
      id: "sh-2",
      featureKey: "max_workspaces",
      value: "unlimited",
      productId: "platform",
      source: "self-hosted",
      validFrom: "2020-01-01T00:00:00Z",
      validUntil: null,
    },
    {
      id: "sh-3",
      featureKey: "max_members",
      value: "unlimited",
      productId: "platform",
      source: "self-hosted",
      validFrom: "2020-01-01T00:00:00Z",
      validUntil: null,
    },
    {
      id: "sh-4",
      featureKey: "sso_enabled",
      value: "true",
      productId: "platform",
      source: "self-hosted",
      validFrom: "2020-01-01T00:00:00Z",
      validUntil: null,
    },
    {
      id: "sh-5",
      featureKey: "audit_logs",
      value: "true",
      productId: "platform",
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

    const res = await fetch(url);

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
