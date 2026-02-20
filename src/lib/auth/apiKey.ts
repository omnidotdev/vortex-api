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

  // Look up API key in integrations table
  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.type, "api_key"),
      eq(integrationTable.isEnabled, true),
    ),
  });

  if (!integration) {
    return null;
  }

  // Check if the API key matches
  const config = integration.config as { apiKey?: string };
  if (config.apiKey !== apiKey) {
    return null;
  }

  return { organizationId: integration.organizationId, name: integration.name };
};

export default validateApiKey;
