import { AUTHZ_API_URL } from "lib/config/env.config";
import logger from "lib/logger";
import {
  buildPermissionCacheKey,
  getCachedPermission,
  setCachedPermission,
} from "./cache";
import { checkPermission } from "./client";

/** TTL (in seconds) for cached authZ decisions. */
const AUTHORIZE_CACHE_TTL_SECONDS = 60;

/**
 * Collaborators for {@link authorize}. Each defaults to the real module-level
 * implementation; tests inject fakes (and a controlled `authzApiUrl`) so the
 * wrapper can be exercised without mocking modules or mutating the environment.
 */
interface AuthorizeDeps {
  authzApiUrl?: string;
  checkPermission?: typeof checkPermission;
  getCachedPermission?: typeof getCachedPermission;
  setCachedPermission?: typeof setCachedPermission;
  buildPermissionCacheKey?: typeof buildPermissionCacheKey;
}

/**
 * Check if a user has a relation on a resource via Warden (OpenFGA).
 * Returns true if Warden is disabled. Fail-closed when Warden is
 * enabled but unreachable (denies access to match circuit breaker behavior).
 *
 * Results are cached for 60 seconds to reduce redundant Warden calls
 * across a single user's request burst.
 */
const authorize = async (
  userId: string,
  resourceType: string,
  resourceId: string,
  relation: string,
  deps: AuthorizeDeps = {},
): Promise<boolean> => {
  const {
    authzApiUrl = AUTHZ_API_URL,
    checkPermission: check = checkPermission,
    getCachedPermission: getCached = getCachedPermission,
    setCachedPermission: setCached = setCachedPermission,
    buildPermissionCacheKey: buildKey = buildPermissionCacheKey,
  } = deps;

  if (!authzApiUrl) return true;

  const cacheKey = buildKey(userId, resourceType, resourceId, relation);

  try {
    const cached = await getCached(cacheKey);
    if (cached !== null) return cached;
  } catch (error) {
    // Cache lookup errors are non-fatal; fall through to live check
    logger.debug("Warden cache lookup failed, performing live check", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const allowed = await check(
      "true",
      authzApiUrl,
      userId,
      resourceType,
      resourceId,
      relation,
    );

    // Populate cache on success
    try {
      await setCached(cacheKey, allowed, AUTHORIZE_CACHE_TTL_SECONDS);
    } catch (error) {
      logger.debug("Warden cache populate failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return allowed;
  } catch (error) {
    logger.error("Warden authZ check failed, denying request", {
      userId,
      resourceType,
      resourceId,
      relation,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

export default authorize;
