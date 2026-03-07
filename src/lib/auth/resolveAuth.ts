import validateApiKey from "lib/auth/apiKey";
import validateSession from "lib/auth/session";

/**
 * Resolve authentication from an Authorization header.
 *
 * Tries API key validation first (Gatekeeper `omni_*` keys and internal
 * service keys), then falls back to OAuth Bearer session token validation.
 *
 * @param authHeader - Authorization header value
 * @returns Organization context or null if both methods fail
 */
const resolveAuth = async (
  authHeader: string | undefined,
): Promise<{ organizationId: string; name?: string; userId?: string } | null> => {
  // Try API key first (fastest path for service-to-service and CLI usage)
  const apiKeyInfo = await validateApiKey(authHeader);
  if (apiKeyInfo) return apiKeyInfo;

  // Fall back to session token (vortex-app OAuth flow)
  const sessionInfo = await validateSession(authHeader);
  if (sessionInfo) return sessionInfo;

  return null;
};

export default resolveAuth;
