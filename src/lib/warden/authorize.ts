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
): Promise<boolean> => {
  if (!AUTHZ_API_URL) return true;

  const cacheKey = buildPermissionCacheKey(
    userId,
    resourceType,
    resourceId,
    relation,
  );

  try {
    const cached = await getCachedPermission(cacheKey);
    if (cached !== null) return cached;
  } catch (error) {
    // Cache lookup errors are non-fatal; fall through to live check
    logger.debug("Warden cache lookup failed, performing live check", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const allowed = await checkPermission(
      "true",
      AUTHZ_API_URL,
      userId,
      resourceType,
      resourceId,
      relation,
    );

    // Populate cache on success
    try {
      await setCachedPermission(
        cacheKey,
        allowed,
        AUTHORIZE_CACHE_TTL_SECONDS,
      );
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
