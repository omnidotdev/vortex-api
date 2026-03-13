/**
 * Hatchet event client.
 *
 * Pushes events to Hatchet via the vortex-worker's internal HTTP endpoint.
 * The worker maintains a long-lived gRPC connection to Hatchet which is
 * reliable within Railway's private network. Direct gRPC from vortex-api
 * hangs due to Railway networking limitations with new connections.
 */

import { INTERNAL_API_SECRET } from "lib/config/env.config";
import logger from "lib/logger";

const WORKER_URL =
  process.env.VORTEX_WORKER_URL ?? "http://vortex-worker.railway.internal:8080";

/**
 * Push an event to Hatchet via the worker's HTTP relay.
 * @param key - Event key (e.g. "workflow:execute")
 * @param payload - Event payload
 * @throws If the worker is unreachable or the push fails
 */
export async function pushEvent(
  key: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${WORKER_URL}/push-event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${INTERNAL_API_SECRET}`,
    },
    body: JSON.stringify({ key, payload }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Hatchet push-event failed (${res.status}): ${body}`);
  }

  logger.info("Event pushed via worker relay", { key });
}

/**
 * Check if Hatchet push is configured (worker URL and secret present).
 */
export function isConfigured(): boolean {
  return !!INTERNAL_API_SECRET;
}
