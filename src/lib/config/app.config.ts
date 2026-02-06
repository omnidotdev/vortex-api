import type { EventsConfig } from "lib/events";

const { EVENTS_URL, IGGY_USERNAME, IGGY_PASSWORD } = process.env;

/**
 * Application configuration.
 */
const app = {
  name: "Vortex",
  version: process.env.APP_VERSION ?? "0.0.0",
};

/**
 * Parse events config from `EVENTS_URL` (e.g. `iggy://host:port`).
 * Returns null when the URL is not set, making events opt-in
 */
export function getEventsConfig(): EventsConfig | null {
  if (!EVENTS_URL) return null;

  try {
    const url = new URL(EVENTS_URL);

    return {
      host: url.hostname,
      port: Number(url.port) || 8090,
      username: IGGY_USERNAME ?? "iggy",
      password: IGGY_PASSWORD ?? "iggy",
    };
  } catch {
    throw new Error(`Invalid EVENTS_URL: ${EVENTS_URL}`);
  }
}

export default app;
