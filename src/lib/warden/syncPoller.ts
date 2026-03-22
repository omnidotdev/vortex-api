/**
 * Warden Sync Poller
 *
 * Retries failed Warden tuple writes from the sync queue with exponential
 * backoff. Prevents users from being permanently locked out when Warden
 * is transiently unavailable during organization or membership changes.
 */

import { and, eq, inArray, lte } from "drizzle-orm";

import {
  acquireWardenSyncLock,
  isCacheConfigured,
  releaseWardenSyncLock,
} from "lib/cache";
import { AUTHZ_API_URL } from "lib/config/env.config";
import { dbPool as db } from "lib/db/db";
import { wardenSyncQueueTable } from "lib/db/schema";
import logger from "lib/logger";
import { deleteTuples, writeTuples } from "./client";

const { NODE_ENV } = process.env;
const isProdEnv = NODE_ENV === "production";

/** Poll interval (30 seconds) */
const POLL_INTERVAL_MS = 30_000;

/** Maximum items to process per tick */
const BATCH_SIZE = 50;

/** Base backoff for exponential retry (1 second) */
const BASE_BACKOFF_MS = 1_000;

let pollInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Calculate next retry time with exponential backoff and jitter.
 */
function nextRetryTime(attempts: number): Date {
  const backoff = BASE_BACKOFF_MS * 2 ** attempts;
  // Cap at 1 hour
  const capped = Math.min(backoff, 3_600_000);
  // Add 0-25% jitter
  const jitter = Math.random() * capped * 0.25;

  return new Date(Date.now() + capped + jitter);
}

/**
 * Process pending items in the sync queue.
 */
async function processSyncQueue(): Promise<void> {
  if (!AUTHZ_API_URL) return;

  const token = await acquireWardenSyncLock();
  if (!token) return;

  try {
    const now = new Date();

    // Fetch items ready for retry
    const pending = await db
      .select()
      .from(wardenSyncQueueTable)
      .where(
        and(
          inArray(wardenSyncQueueTable.status, ["pending", "retrying"]),
          lte(wardenSyncQueueTable.nextRetryAt, now),
        ),
      )
      .limit(BATCH_SIZE);

    if (pending.length === 0) return;

    logger.info("Processing Warden sync queue", { count: pending.length });

    for (const item of pending) {
      const newAttempts = item.attempts + 1;

      try {
        if (item.operation === "write") {
          await writeTuples(AUTHZ_API_URL, item.tuples);
        } else if (item.operation === "delete") {
          await deleteTuples(AUTHZ_API_URL, item.tuples);
        }

        // Mark completed
        await db
          .update(wardenSyncQueueTable)
          .set({
            status: "completed",
            attempts: newAttempts,
            completedAt: new Date(),
          })
          .where(eq(wardenSyncQueueTable.id, item.id));

        logger.info("Warden sync queue item completed", {
          id: item.id,
          description: item.description,
          attempts: newAttempts,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        if (newAttempts >= item.maxAttempts) {
          // Exhausted retries — mark as failed
          await db
            .update(wardenSyncQueueTable)
            .set({
              status: "failed",
              attempts: newAttempts,
              lastError: errorMessage,
            })
            .where(eq(wardenSyncQueueTable.id, item.id));

          logger.error("Warden sync queue item failed permanently", {
            id: item.id,
            description: item.description,
            attempts: newAttempts,
            error: errorMessage,
          });
        } else {
          // Schedule retry with backoff
          await db
            .update(wardenSyncQueueTable)
            .set({
              status: "retrying",
              attempts: newAttempts,
              lastError: errorMessage,
              nextRetryAt: nextRetryTime(newAttempts),
            })
            .where(eq(wardenSyncQueueTable.id, item.id));

          logger.warn("Warden sync queue item retry scheduled", {
            id: item.id,
            description: item.description,
            attempts: newAttempts,
            error: errorMessage,
          });
        }
      }
    }
  } catch (err) {
    logger.error("Error processing Warden sync queue", {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    await releaseWardenSyncLock(token);
  }
}

/**
 * Start the Warden sync poller.
 */
export function startWardenSyncPoller(): void {
  if (pollInterval) {
    logger.warn("Warden sync poller already running");
    return;
  }

  if (isProdEnv && !isCacheConfigured()) {
    logger.error(
      "Cache is required in production for distributed Warden sync locking. Set CACHE_URL to enable",
    );
    throw new Error(
      "Cache is required for Warden sync poller in production to prevent duplicate processing",
    );
  }

  if (!isCacheConfigured()) {
    logger.warn(
      "Running without cache. Warden sync poller will work but is not safe for multi-instance deployments",
    );
  }

  logger.info("Warden sync poller started", {
    pollIntervalMs: POLL_INTERVAL_MS,
  });

  // Run immediately on start
  processSyncQueue();

  // Schedule periodic processing
  pollInterval = setInterval(processSyncQueue, POLL_INTERVAL_MS);
}

/**
 * Stop the Warden sync poller.
 */
export function stopWardenSyncPoller(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    logger.info("Warden sync poller stopped");
  }
}
