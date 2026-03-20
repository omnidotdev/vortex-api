import { AUTHZ_API_URL, AUTHZ_ENABLED } from "lib/config/env.config";
import logger from "lib/logger";
import { checkPermission } from "./client";

/**
 * Check if a user has a relation on a resource via Warden (OpenFGA).
 * Returns true if Warden is disabled. Fail-closed when Warden is
 * enabled but unreachable (denies access to match circuit breaker behavior).
 */
const authorize = async (
  userId: string,
  resourceType: string,
  resourceId: string,
  relation: string,
): Promise<boolean> => {
  if (!AUTHZ_API_URL || AUTHZ_ENABLED !== "true") return true;

  try {
    return await checkPermission(
      AUTHZ_ENABLED,
      AUTHZ_API_URL,
      userId,
      resourceType,
      resourceId,
      relation,
    );
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
