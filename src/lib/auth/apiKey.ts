import { timingSafeEqual } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { dbPool as db } from "lib/db/db";
import { integrationTable } from "lib/db/schema";

type ApiKeyInfo = { organizationId: string; name: string };

/**
 * Validate API key and return the associated organization context.
 */
const validateApiKey = async (
  authHeader: string | undefined,
): Promise<ApiKeyInfo | null> => {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const apiKey = authHeader.slice(7);

  // Look up all enabled API key integrations across all orgs
  const integrations = await db.query.integrationTable.findMany({
    where: and(
      eq(integrationTable.type, "api_key"),
      eq(integrationTable.isEnabled, true),
    ),
  });

  const providedKey = Buffer.from(apiKey);

  const integration = integrations.find((i) => {
    const cfg = i.config as { apiKey?: string };
    if (!cfg.apiKey) return false;
    const storedKey = Buffer.from(cfg.apiKey);
    return (
      storedKey.length === providedKey.length &&
      timingSafeEqual(storedKey, providedKey)
    );
  });

  if (!integration) return null;

  return { organizationId: integration.organizationId, name: integration.name };
};

export default validateApiKey;
