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

/**
 * Reserved CloudEvents `source` for platform/system events (e.g. the Omni API's
 * `platform.plan.*` mutations). Events under this source can trigger
 * platform-wide side effects downstream (the vortex-worker bridges them to a
 * tier-sync entitlement reseed), so only the internal service principal may
 * claim it.
 */
export const PLATFORM_EVENT_SOURCE = "omni.platform";

/**
 * Effective CloudEvents `source` for an ingested event, pinned to the
 * authenticated principal. A trusted service key may set any source (including
 * the reserved platform source, as the Omni API does). Every other caller may
 * set its own product/tenant source but must NOT forge the reserved platform
 * source; doing so returns `null` so the ingest endpoint can reject the request.
 * When no source is supplied it defaults to the credential name.
 */
export const resolveEventSource = (
  authInfo: { name?: string; isServiceKey?: boolean },
  requestedSource: string | undefined,
): string | null => {
  const source = requestedSource || authInfo.name || "unknown";

  if (source === PLATFORM_EVENT_SOURCE && !authInfo.isServiceKey) {
    return null;
  }

  return source;
};

export default resolveAuth;
