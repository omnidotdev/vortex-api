/**
 * Redis client for distributed coordination.
 *
 * Used for distributed locking (cron scheduler) and caching.
 * In development, Redis is optional and falls back to single-instance mode.
 * In production, Redis is REQUIRED for cron scheduling.
 */

import { createClient } from "redis";

const { REDIS_URL } = process.env;

/**
 * Check if Redis is configured.
 */
export function isRedisConfigured(): boolean {
  return Boolean(REDIS_URL);
}

/**
 * Redis client instance.
 * Will be null if REDIS_URL is not configured.
 */
export const redisClient = REDIS_URL ? createClient({ url: REDIS_URL }) : null;

/**
 * Initialize Redis connection.
 * Safe to call even if Redis is not configured.
 */
export async function initRedis(): Promise<void> {
  if (redisClient) {
    redisClient.on("error", (err) => {
      console.error("[Redis] Connection error:", err);
    });

    await redisClient.connect();
    // biome-ignore lint/suspicious/noConsole: startup logging
    console.log("[Redis] Connected");
  }
}

/**
 * Close Redis connection.
 * Safe to call even if Redis is not configured.
 */
export async function closeRedis(): Promise<void> {
  if (redisClient?.isOpen) {
    await redisClient.quit();
    // biome-ignore lint/suspicious/noConsole: shutdown logging
    console.log("[Redis] Disconnected");
  }
}
