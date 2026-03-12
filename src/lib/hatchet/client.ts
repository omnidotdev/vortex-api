/**
 * Hatchet REST event client.
 *
 * Uses the Hatchet REST API (`POST /api/v1/tenants/:id/events/push`) instead
 * of gRPC. Railway's internal network can't reliably establish new gRPC
 * connections to the Hatchet TCP proxy, but HTTPS works fine. The worker
 * (which maintains a long-lived gRPC streaming connection) is unaffected.
 *
 * Config is extracted directly from the `HATCHET_CLIENT_TOKEN` JWT to avoid
 * depending on the Hatchet SDK's gRPC channel initialization.
 */

import logger from "lib/logger";

type HatchetConfig = {
  apiUrl: string;
  tenantId: string;
  token: string;
};

let _config: HatchetConfig | null = null;

function getConfig(): HatchetConfig | null {
  if (_config) return _config;

  const token = process.env.HATCHET_CLIENT_TOKEN;
  if (!token) return null;

  try {
    const [, claimsPart] = token.split(".");
    const claims = JSON.parse(
      atob(claimsPart.replace(/-/g, "+").replace(/_/g, "/")),
    );

    _config = {
      apiUrl: process.env.HATCHET_CLIENT_API_URL ?? claims.server_url,
      tenantId: claims.sub,
      token,
    };
    return _config;
  } catch {
    logger.warn("Hatchet not configured — invalid or missing client token");
    return null;
  }
}

/**
 * Push an event to Hatchet via REST API.
 * @param key - Event key (e.g. "workflow:execute")
 * @param payload - Event payload (will be JSON-stringified)
 * @throws If Hatchet is not configured or the request fails
 */
export async function pushEvent(
  key: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const config = getConfig();
  if (!config) {
    throw new Error("Hatchet not configured — HATCHET_CLIENT_TOKEN is missing");
  }

  const res = await fetch(
    `${config.apiUrl}/api/v1/tenants/${config.tenantId}/events/push`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key,
        payload: JSON.stringify(payload),
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Hatchet event push failed (${res.status}): ${body}`);
  }
}

/**
 * Check if Hatchet is configured (token present and parseable).
 */
export function isConfigured(): boolean {
  return getConfig() !== null;
}
