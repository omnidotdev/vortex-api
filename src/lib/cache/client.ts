/**
 * Cache client for distributed coordination.
 *
 * Used for distributed locking (cron scheduler) and caching.
 * In development, cache is optional and falls back to single-instance mode.
 * In production, cache is REQUIRED for cron scheduling.
 */

import Valkey from "iovalkey";

import logger from "lib/logger";

const { CACHE_URL } = process.env;

/**
 * Check if cache is configured.
 */
export function isCacheConfigured(): boolean {
  return Boolean(CACHE_URL);
}

/**
 * Cache client instance.
 * Will be null if CACHE_URL is not configured.
 */
export const cacheClient = CACHE_URL
  ? new Valkey(CACHE_URL, { lazyConnect: true })
  : null;

/**
 * Initialize cache connection.
 * Safe to call even if cache is not configured.
 */
export async function initCache(): Promise<void> {
  if (cacheClient) {
    cacheClient.on("error", (err) => {
      logger.error("Cache connection error", {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    await cacheClient.connect();
    logger.info("Cache connected");
  }
}

/**
 * Close cache connection.
 * Safe to call even if cache is not configured.
 */
export async function closeCache(): Promise<void> {
  if (cacheClient?.status === "ready") {
    await cacheClient.quit();
    logger.info("Cache disconnected");
  }
}
