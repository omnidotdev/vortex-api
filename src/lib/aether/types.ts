/**
 * Aether entitlements types.
 */

export interface Entitlement {
  id: string;
  productId: string;
  featureKey: string;
  value: string | null;
  source: string;
  validFrom: string;
  validUntil: string | null;
}

export interface EntitlementsResponse {
  billingAccountId: string;
  entityType: string;
  entityId: string;
  entitlementVersion: number;
  entitlements: Entitlement[];
}
