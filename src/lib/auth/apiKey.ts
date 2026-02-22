import { AUTH_BASE_URL } from "lib/config/env.config";
import logger from "lib/logger";

type ApiKeyInfo = { organizationId: string; name: string };

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
 */
const validateApiKey = async (
  authHeader: string | undefined,
): Promise<ApiKeyInfo | null> => {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const key = authHeader.slice(7);

  // Gatekeeper mounts Better Auth at basePath "/", so the verify path is /api-key/verify
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
  };
};

export default validateApiKey;
