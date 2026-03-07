import { eq } from "drizzle-orm";

import { AUTH_BASE_URL } from "lib/config/env.config";
import { dbPool as db } from "lib/db/db";
import { userOrganizationTable, userTable } from "lib/db/schema";
import logger from "lib/logger";

// Response shape from Gatekeeper's OIDC userinfo endpoint
type UserinfoResponse = {
  sub: string;
  name?: string;
  email?: string;
};

/**
 * Validate an OAuth access token via Gatekeeper's userinfo endpoint
 * and resolve the caller's organization membership.
 *
 * @param authHeader - Authorization header value (Bearer <token>)
 * @returns Organization and user context, or null if invalid
 */
const validateSession = async (
  authHeader: string | undefined,
): Promise<{ organizationId: string; userId: string } | null> => {
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  // Validate access token via Gatekeeper's OIDC userinfo endpoint
  let userinfo: UserinfoResponse;
  try {
    const res = await fetch(`${AUTH_BASE_URL}/oauth2/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return null;

    userinfo = (await res.json()) as UserinfoResponse;
  } catch (err) {
    logger.error("Failed to reach Gatekeeper for token verification", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  if (!userinfo?.sub) return null;

  // Look up local user by IDP identity
  const user = await db.query.userTable.findFirst({
    where: eq(userTable.identityProviderId, userinfo.sub),
    columns: { id: true },
  });

  if (!user) return null;

  // Get the user's first organization membership
  const membership = await db.query.userOrganizationTable.findFirst({
    where: eq(userOrganizationTable.userId, user.id),
    columns: { organizationId: true },
  });

  if (!membership) return null;

  return { organizationId: membership.organizationId, userId: user.id };
};

export default validateSession;
