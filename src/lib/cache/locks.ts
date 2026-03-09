/**
 * Distributed locking utilities using cache.
 *
 * Uses SET NX EX pattern for simple distributed locks.
 * Falls back to always-acquire if cache is not configured (single-instance mode).
 */

import { randomUUID } from "node:crypto";

import logger from "lib/logger";
import { cacheClient } from "./client";

const CRON_LOCK_TTL_SECONDS = 90; // Slightly longer than 60s check interval

const WORKFLOW_CRON_LOCK_PREFIX = "vortex:cron:lock:";

/**
 * Lua script for compare-and-delete.
 * Only deletes the key if the value matches the provided token,
 * preventing one instance from releasing another's lock.
 */
const COMPARE_AND_DELETE_SCRIPT =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

/**
 * Acquire a per-workflow cron lock with ownership token.
 *
 * Uses SET NX EX with a random UUID token so only the holder can release.
 * @param workflowId - Workflow to lock
 * @returns Ownership token on success, null if lock is already held or on error
 */
export async function acquireWorkflowCronLock(
  workflowId: string,
): Promise<string | null> {
  // No cache = single instance mode, return a token to keep the API consistent
  if (!cacheClient) {
    return randomUUID();
  }

  const key = `${WORKFLOW_CRON_LOCK_PREFIX}${workflowId}`;
  const token = randomUUID();

  try {
    const result = await cacheClient.set(
      key,
      token,
      "EX",
      CRON_LOCK_TTL_SECONDS,
      "NX",
    );

    return result === "OK" ? token : null;
  } catch (err) {
    logger.error("Failed to acquire workflow cron lock", {
      workflowId,
      error: err instanceof Error ? err.message : String(err),
    });

    return null;
  }
}

/**
 * Release a per-workflow cron lock with ownership verification.
 *
 * Uses a Lua compare-and-delete script so only the token holder can release.
 * @param workflowId - Workflow whose lock to release
 * @param token - Ownership token returned by `acquireWorkflowCronLock`
 * @returns true if the lock was released, false if token didn't match or on error
 */
export async function releaseWorkflowCronLock(
  workflowId: string,
  token: string,
): Promise<boolean> {
  // No cache = single instance mode, nothing to release
  if (!cacheClient) {
    return true;
  }

  const key = `${WORKFLOW_CRON_LOCK_PREFIX}${workflowId}`;

  try {
    const result = await cacheClient.eval(
      COMPARE_AND_DELETE_SCRIPT,
      1,
      key,
      token,
    );

    return result === 1;
  } catch (err) {
    logger.error("Failed to release workflow cron lock", {
      workflowId,
      error: err instanceof Error ? err.message : String(err),
    });

    return false;
  }
}

const REAPER_LOCK_TTL_SECONDS = 300; // 5 min, matches check interval

const REAPER_LOCK_KEY = "vortex:reaper:lock";

/**
 * Acquire the global reaper lock with ownership token.
 *
 * Uses SET NX EX with a random UUID token so only the holder can release.
 * @returns Ownership token on success, null if lock is already held or on error
 */
export async function acquireReaperLock(): Promise<string | null> {
  // No cache = single instance mode, return a token to keep the API consistent
  if (!cacheClient) {
    return randomUUID();
  }

  const token = randomUUID();

  try {
    const result = await cacheClient.set(
      REAPER_LOCK_KEY,
      token,
      "EX",
      REAPER_LOCK_TTL_SECONDS,
      "NX",
    );

    return result === "OK" ? token : null;
  } catch (err) {
    logger.error("Failed to acquire reaper lock", {
      error: err instanceof Error ? err.message : String(err),
    });

    return null;
  }
}

/**
 * Release the global reaper lock with ownership verification.
 *
 * Uses a Lua compare-and-delete script so only the token holder can release.
 * @param token - Ownership token returned by `acquireReaperLock`
 * @returns true if the lock was released, false if token didn't match or on error
 */
export async function releaseReaperLock(token: string): Promise<boolean> {
  // No cache = single instance mode, nothing to release
  if (!cacheClient) {
    return true;
  }

  try {
    const result = await cacheClient.eval(
      COMPARE_AND_DELETE_SCRIPT,
      1,
      REAPER_LOCK_KEY,
      token,
    );

    return result === 1;
  } catch (err) {
    logger.error("Failed to release reaper lock", {
      error: err instanceof Error ? err.message : String(err),
    });

    return false;
  }
}
