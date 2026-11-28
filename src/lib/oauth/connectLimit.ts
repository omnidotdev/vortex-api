/**
 * Plan gate for connecting an integration over OAuth.
 *
 * An OAuth connection creates an integration row, so it counts against the
 * same connected-accounts limit (`max_integrations`) that the GraphQL
 * `createIntegration` mutation enforces. Every tier can connect integrations;
 * only the number of connected accounts differs per plan
 */

import { count, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { integrationTable } from "lib/db/schema";
import { FEATURE_KEYS } from "lib/entitlements/constants";
import { getPlanLimit } from "lib/entitlements/enforce";

/**
 * Collaborators for {@link isIntegrationConnectAllowed}. Each defaults to the
 * real implementation; tests inject stubs to exercise the gate without a
 * database or billing service
 */
interface ConnectLimitDeps {
  getPlanLimit?: typeof getPlanLimit;
  countIntegrations?: (organizationId: string) => Promise<number>;
}

/**
 * Count the integrations an organization already has.
 */
const countOrganizationIntegrations = async (
  organizationId: string,
): Promise<number> => {
  const [result] = await dbPool
    .select({ total: count() })
    .from(integrationTable)
    .where(eq(integrationTable.organizationId, organizationId));

  return result?.total ?? 0;
};

/**
 * Check whether an organization may connect one more integration.
 *
 * @param organizationId - The organization connecting the integration.
 * @param deps - Optional collaborators, injected by tests.
 * @returns The current count and limit, and whether one more connection fits.
 * A limit of -1 means unlimited.
 */
export const isIntegrationConnectAllowed = async (
  organizationId: string,
  deps: ConnectLimitDeps = {},
): Promise<{ allowed: boolean; limit: number; current: number }> => {
  const {
    getPlanLimit: planLimit = getPlanLimit,
    countIntegrations = countOrganizationIntegrations,
  } = deps;

  const [limit, current] = await Promise.all([
    planLimit(organizationId, FEATURE_KEYS.MAX_INTEGRATIONS),
    countIntegrations(organizationId),
  ]);

  return { allowed: limit === -1 || current < limit, limit, current };
};
