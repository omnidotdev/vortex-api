/**
 * Redis client for distributed coordination.
 *
 * Used for distributed locking (cron scheduler) and caching.
 * Optional - if REDIS_URL is not set, the client will be null
 * and features requiring Redis will fall back to single-instance mode.
 */

import { createClient } from "redis";

const { REDIS_URL } = process.env;

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
