import { and, eq } from "drizzle-orm";

import { AUTH_BASE_URL } from "lib/config/env.config";
import { dbPool } from "lib/db/db";
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
 * @param targetOrgId - Optional organization ID to scope the session to.
 *   When provided, validates that the user has membership in the specified
 *   org rather than picking an arbitrary first membership.
 * @returns Organization and user context, or null if invalid
 */
const validateSession = async (
  authHeader: string | undefined,
  targetOrgId?: string,
  // Database is injectable so tests can supply a fake without mocking modules
  { db = dbPool }: { db?: typeof dbPool } = {},
): Promise<{
  organizationId: string;
  userId: string;
  idpUserId: string;
} | null> => {
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
    columns: { id: true, identityProviderId: true },
  });

  if (!user) return null;

  // When a target org is specified, verify the user has membership in it
  // instead of picking an arbitrary first membership (which may be the
  // wrong org for multi-org users, causing 403s in Warden)
  if (targetOrgId) {
    const membership = await db.query.userOrganizationTable.findFirst({
      where: and(
        eq(userOrganizationTable.userId, user.id),
        eq(userOrganizationTable.organizationId, targetOrgId),
      ),
      columns: { organizationId: true },
    });

    if (!membership) return null;

    return {
      organizationId: targetOrgId,
      userId: user.id,
      idpUserId: user.identityProviderId,
    };
  }

  // Fallback: pick the first membership (for callers that don't specify)
  const membership = await db.query.userOrganizationTable.findFirst({
    where: eq(userOrganizationTable.userId, user.id),
    columns: { organizationId: true },
  });

  if (!membership) return null;

  return {
    organizationId: membership.organizationId,
    userId: user.id,
    idpUserId: user.identityProviderId,
  };
};

export default validateSession;
