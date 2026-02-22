/**
 * Distributed locking utilities using cache.
 *
 * Uses SET NX EX pattern for simple distributed locks.
 * Falls back to always-acquire if cache is not configured (single-instance mode).
 */

import { randomUUID } from "node:crypto";

import logger from "lib/logger";
import { cacheClient } from "./client";

const CRON_LOCK_KEY = "vortex:cron:lock";
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
 * Attempt to acquire the cron scheduler lock.
 * @deprecated Use `acquireWorkflowCronLock` for per-workflow locking with ownership verification
 * @knipignore
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
 * @deprecated Use `releaseWorkflowCronLock` for per-workflow locking with ownership verification
 * @knipignore
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
    const result = await cacheClient.set(key, token, {
      NX: true,
      EX: CRON_LOCK_TTL_SECONDS,
    });

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
    const result = await cacheClient.eval(COMPARE_AND_DELETE_SCRIPT, {
      keys: [key],
      arguments: [token],
    });

    return result === 1;
  } catch (err) {
    logger.error("Failed to release workflow cron lock", {
      workflowId,
      error: err instanceof Error ? err.message : String(err),
    });

    return false;
  }
}
