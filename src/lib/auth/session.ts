import { eq } from "drizzle-orm";

import { AUTH_BASE_URL } from "lib/config/env.config";
import { dbPool as db } from "lib/db/db";
import { userOrganizationTable, userTable } from "lib/db/schema";
import logger from "lib/logger";

// Response shape from Gatekeeper's Better Auth get-session endpoint
type GatekeeperSessionResponse = {
  session: {
    id: string;
    userId: string;
    token: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
};

/**
 * Validate an OAuth Bearer session token via Gatekeeper and resolve
 * the caller's organization membership.
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

  // Verify session with Gatekeeper
  let sessionData: GatekeeperSessionResponse;
  try {
    const res = await fetch(`${AUTH_BASE_URL}/get-session`, {
      headers: {
        Cookie: `better-auth.session_token=${token}`,
        Origin: AUTH_BASE_URL!,
      },
    });

    if (!res.ok) return null;

    sessionData = (await res.json()) as GatekeeperSessionResponse;
  } catch (err) {
    logger.error("Failed to reach Gatekeeper for session verification", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  if (!sessionData?.user?.id) return null;

  const idpUserId = sessionData.user.id;

  // Look up local user by IDP identity
  const user = await db.query.userTable.findFirst({
    where: eq(userTable.identityProviderId, idpUserId),
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
