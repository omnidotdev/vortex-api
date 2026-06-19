/**
 * Warden authorization client.
 *
 * Thin layer over the @omnidotdev/providers Warden authz client, which is the
 * source of truth for the transport, circuit breaker, and TTL cache. The
 * exported functions keep their current signatures (the `providerUrl` /
 * `authzProviderUrl` parameters are the existing call seam, including
 * graphile-export EXPORTABLE usage) and delegate to the providers client.
 */

import { createAuthzProvider } from "@omnidotdev/providers";

import { AUTHZ_API_URL, AUTHZ_SERVICE_KEY } from "lib/config/env.config";

import type { WardenRelation, WardenResourceType } from "@omnidotdev/providers";

/**
 * Warden authorization client from @omnidotdev/providers, the source of truth
 * for the transport, circuit breaker, and TTL cache. Kept local to this module
 * (rather than the shared lib/providers) so authz mocking in other test files
 * cannot destabilize it. Null when authz is not configured.
 */
const authz = AUTHZ_API_URL
  ? createAuthzProvider({
      apiUrl: AUTHZ_API_URL,
      serviceKey: AUTHZ_SERVICE_KEY,
    })
  : null;

// Re-export cache functions for use in plugins
/** @knipignore */
export {
  buildPermissionCacheKey,
  getCachedPermission,
  invalidatePermissionCache,
  setCachedPermission,
} from "./cache";

// Re-export for EXPORTABLE compatibility in plugins
/** @knipignore */
export { AUTHZ_API_URL };

/**
 * Write tuples to the authorization store.
 * Exported for graphile-export EXPORTABLE compatibility.
 */
export const writeTuples = async (
  _providerUrl: string,
  tuples: Array<{ user: string; relation: string; object: string }>,
): Promise<void> => {
  if (!authz?.writeTuples) return;

  const result = await authz.writeTuples(tuples);
  if (!result.success) {
    throw new Error(`AuthZ write tuples failed: ${result.error}`);
  }
};

/**
 * Delete tuples from the authorization store.
 * Exported for graphile-export EXPORTABLE compatibility.
 */
export const deleteTuples = async (
  _providerUrl: string,
  tuples: Array<{ user: string; relation: string; object: string }>,
): Promise<void> => {
  if (!authz?.deleteTuples) return;

  const result = await authz.deleteTuples(tuples);
  if (!result.success) {
    throw new Error(`AuthZ delete tuples failed: ${result.error}`);
  }
};

/**
 * Check if a user has permission on a resource.
 * Exported for graphile-export EXPORTABLE compatibility.
 *
 * Returns true (permissive) when authz is disabled. Throws (fail-closed) when
 * Warden is unavailable, matching the previous behavior.
 *
 * `resourceType` and `permission` are accepted as strings for the existing call
 * seam and cast to the providers contract here.
 */
export const checkPermission = async (
  /** @deprecated Ignored; authz is derived from configuration */
  _authzEnabled: string | undefined,
  authzProviderUrl: string | undefined,
  userId: string,
  resourceType: string,
  resourceId: string,
  permission: string,
  requestCache?: Map<string, boolean>,
): Promise<boolean> => {
  // Permissive when disabled
  if (!authzProviderUrl || !authz) return true;

  return authz.checkPermission(
    userId,
    resourceType as WardenResourceType,
    resourceId,
    permission as WardenRelation,
    requestCache,
  );
};
