/**
 * Distributed locking utilities using cache.
 *
 * Uses SET NX EX pattern for simple distributed locks.
 * Falls back to always-acquire if cache is not configured (single-instance mode).
 */

import logger from "lib/logger";
import { cacheClient } from "./client";

const CRON_LOCK_KEY = "vortex:cron:lock";
const CRON_LOCK_TTL_SECONDS = 90; // Slightly longer than 60s check interval

/**
 * Attempt to acquire the cron scheduler lock.
 *
 * @returns true if lock was acquired, false if another instance holds it
 */
export async function acquireCronLock(): Promise<boolean> {
  // No cache = single instance mode, always proceed
  if (!cacheClient) {
    return true;
  }

  try {
    const result = await cacheClient.set(
      CRON_LOCK_KEY,
      `${Date.now()}:${process.pid}`,
      {
        NX: true, // Only set if not exists
        EX: CRON_LOCK_TTL_SECONDS,
      },
    );

    return result === "OK";
  } catch (err) {
    logger.error("Failed to acquire cron lock", {
      error: err instanceof Error ? err.message : String(err),
    });
    // On error, don't acquire lock to prevent duplicates
    return false;
  }
}

/**
 * Release the cron scheduler lock.
 *
 * Note: This is a simple release that doesn't check ownership.
 * For production, consider using a Lua script to verify ownership.
 */
export async function releaseCronLock(): Promise<void> {
  if (!cacheClient) {
    return;
  }

  try {
    await cacheClient.del(CRON_LOCK_KEY);
  } catch (err) {
    logger.error("Failed to release cron lock", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
