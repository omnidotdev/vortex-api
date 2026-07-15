import validateApiKeyImpl from "lib/auth/apiKey";
import validateSessionImpl from "lib/auth/session";

/**
 * Collaborators for {@link resolveAuth}. Each defaults to the real validator;
 * tests inject fakes to exercise the API-key/session fallback wiring without
 * mocking modules.
 */
interface ResolveAuthDeps {
  validateApiKey?: typeof validateApiKeyImpl;
  validateSession?: typeof validateSessionImpl;
}

/**
 * Resolve authentication from an Authorization header.
 *
 * Tries API key validation first (Gatekeeper `omni_*` keys and internal
 * service keys), then falls back to OAuth Bearer session token validation.
 *
 * @param authHeader - Authorization header value
 * @param targetOrgId - Optional organization ID to scope the session to.
 *   Only applies to session-based auth (not API keys, which already carry
 *   their org binding).
 * @returns Organization context or null if both methods fail
 */
const resolveAuth = async (
  authHeader: string | undefined,
  targetOrgId?: string,
  {
    validateApiKey = validateApiKeyImpl,
    validateSession = validateSessionImpl,
  }: ResolveAuthDeps = {},
): Promise<{
  organizationId: string;
  name?: string;
  userId?: string;
  idpUserId?: string;
  isServiceKey?: boolean;
} | null> => {
  // Try API key first (fastest path for service-to-service and CLI usage)
  const apiKeyInfo = await validateApiKey(authHeader);
  if (apiKeyInfo) return apiKeyInfo;

  // Fall back to session token (vortex-app OAuth flow)
  const sessionInfo = await validateSession(authHeader, targetOrgId);
  if (sessionInfo) return sessionInfo;

  return null;
};

/**
 * Effective org for an ingested event. A trusted service key may act on behalf
 * of a specific org via the `x-on-behalf-of-org` header (service-to-service
 * delegation); every other caller uses the org bound to its credential.
 */
export const resolveEventOrg = (
  authInfo: { organizationId: string; isServiceKey?: boolean },
  onBehalfOf: string | undefined,
): string =>
  authInfo.isServiceKey && onBehalfOf ? onBehalfOf : authInfo.organizationId;

export default resolveAuth;
