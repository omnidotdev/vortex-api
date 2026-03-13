/**
 * Hatchet event client.
 *
 * Uses the Hatchet SDK's gRPC event push to dispatch events to the Hatchet v1
 * engine. The SDK is initialized eagerly at import time and the gRPC channel
 * is warmed up in the background so the connection is ready before the first
 * request arrives. Keepalive pings (every 10s) maintain the long-lived
 * connection.
 */

import Hatchet from "@hatchet-dev/typescript-sdk";

import logger from "lib/logger";

// Eagerly initialize — gRPC channel is created at import time
let _hatchet: ReturnType<typeof Hatchet.init> | null = null;

try {
  _hatchet = Hatchet.init();
  logger.info("Hatchet SDK initialized (gRPC)");
} catch (err) {
  logger.warn("Hatchet SDK init failed — event push unavailable", {
    error: err instanceof Error ? err.message : String(err),
  });
}

// Warm up the gRPC connection in the background so it's ready for requests.
// The SDK's nice-grpc channel establishes the TCP connection on first RPC call;
// sending a no-op event at startup forces that handshake to happen early.
if (_hatchet) {
  _hatchet.event
    .push("system:healthcheck", { source: "vortex-api", ts: Date.now() })
    .then(() => logger.info("Hatchet gRPC connection warmed up"))
    .catch((err) =>
      logger.warn("Hatchet gRPC warm-up failed — will retry on first push", {
        error: err instanceof Error ? err.message : String(err),
      }),
    );
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
  if (!_hatchet) {
    throw new Error(
      "Hatchet not configured — HATCHET_CLIENT_TOKEN is missing or SDK init failed",
    );
  }

  await _hatchet.event.push(key, payload);
}

/**
 * Check if Hatchet is configured (token present and SDK initializable).
 */
export function isConfigured(): boolean {
  return _hatchet !== null;
}
