/**
 * Hatchet event client.
 *
 * Uses the Hatchet SDK's gRPC event push (long-lived connection) to dispatch
 * events to the Hatchet v1 engine. The SDK is initialized lazily on first use
 * and the gRPC channel is kept alive for subsequent calls.
 *
 * Falls back to REST (`POST /api/v1/tenants/:id/events/push`) when the
 * `HATCHET_CLIENT_API_URL` env var is set (for v0 engines or testing).
 */

import Hatchet from "@hatchet-dev/typescript-sdk";

import logger from "lib/logger";

// Lazy SDK client — initialized once, kept alive for the process lifetime
let _hatchet: ReturnType<typeof Hatchet.init> | null = null;
let _initAttempted = false;

function getHatchet(): ReturnType<typeof Hatchet.init> | null {
  if (_hatchet) return _hatchet;
  if (_initAttempted) return null;

  _initAttempted = true;

  try {
    _hatchet = Hatchet.init();
    logger.info("Hatchet SDK initialized (gRPC)");
    return _hatchet;
  } catch (err) {
    logger.warn("Hatchet SDK init failed — event push unavailable", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Push an event to Hatchet via gRPC (SDK).
 * @param key - Event key (e.g. "workflow:execute")
 * @param payload - Event payload
 * @throws If Hatchet is not configured or the push fails
 */
export async function pushEvent(
  key: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const hatchet = getHatchet();
  if (!hatchet) {
    throw new Error(
      "Hatchet not configured — HATCHET_CLIENT_TOKEN is missing or SDK init failed",
    );
  }

  await hatchet.event.push(key, payload);
}

/**
 * Check if Hatchet is configured (token present and SDK initializable).
 */
export function isConfigured(): boolean {
  return getHatchet() !== null;
}
