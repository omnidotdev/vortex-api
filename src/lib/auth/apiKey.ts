import { AUTH_BASE_URL, INTERNAL_API_SECRET } from "lib/config/env.config";
import secretsMatch from "lib/crypto/secretsMatch";
import logger from "lib/logger";

type ApiKeyInfo = { organizationId: string; name: string; userId?: string };

/** Organization ID used for service-key authenticated requests */
const SERVICE_ORG_ID = process.env.SERVICE_ORGANIZATION_ID;

// Response shape from Gatekeeper's Better Auth apiKey verify endpoint
type GatekeeperVerifyResponse = {
  valid: boolean;
  error?: { message: string; code: string };
  key?: {
    id: string;
    name: string | null;
    userId: string;
    metadata: string | null; // JSON string: { organizationId, workspaceSlug? }
    enabled: boolean;
  };
};

/**
 * Validate API key and return the associated organization context.
 *
 * Supports two auth mechanisms:
 * 1. Gatekeeper API key (omni_... prefix) — verified via Better Auth
 * 2. Internal service key (INTERNAL_API_SECRET) — for service-to-service auth
 */
const validateApiKey = async (
  authHeader: string | undefined,
): Promise<ApiKeyInfo | null> => {
  if (!authHeader) return null;

  // Extract key — strip "Bearer " prefix if present
  const key = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  // Check internal service key first (service-to-service auth)
  if (
    INTERNAL_API_SECRET &&
    SERVICE_ORG_ID &&
    secretsMatch(key, INTERNAL_API_SECRET)
  ) {
    return { organizationId: SERVICE_ORG_ID, name: "Service Key" };
  }

  // Gatekeeper API key path requires Bearer format
  if (!authHeader.startsWith("Bearer ")) return null;

  // Fall back to Gatekeeper API key verification
  const verifyUrl = `${AUTH_BASE_URL}/api-key/verify`;

  let res: Response;
  try {
    res = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
  } catch (err) {
    logger.error("Failed to reach Gatekeeper for API key verification", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  if (!res.ok) {
    return null;
  }

  let data: GatekeeperVerifyResponse;
  try {
    data = (await res.json()) as GatekeeperVerifyResponse;
  } catch {
    return null;
  }

  if (!data.valid || !data.key) {
    return null;
  }

  if (!data.key.enabled) {
    logger.warn("Disabled API key used", { keyId: data.key.id });
    return null;
  }

  // Extract organizationId from metadata
  let organizationId: string | null = null;
  if (data.key.metadata) {
    try {
      const meta = JSON.parse(data.key.metadata) as {
        organizationId?: string;
        workspaceSlug?: string;
      };
      organizationId = meta.organizationId ?? null;
    } catch {
      // malformed metadata
    }
  }

  if (!organizationId) {
    logger.warn("API key missing organizationId in metadata", {
      keyId: data.key.id,
    });
    return null;
  }

  return {
    organizationId,
    name: data.key.name ?? "API Key",
    userId: data.key.userId,
  };
};

export default validateApiKey;
