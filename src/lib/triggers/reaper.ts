/**
 * Stale Run Reaper
 *
 * Periodically checks for workflow runs stuck in "running" or "pending" status
 * and marks them as failed after exceeding the maximum execution time.
 */

import { and, inArray, lte } from "drizzle-orm";

import {
  acquireReaperLock,
  isCacheConfigured,
  releaseReaperLock,
} from "lib/cache";
import { dbPool as db } from "lib/db/db";
import { workflowRunTable } from "lib/db/schema";
import logger from "lib/logger";

const { STALE_RUN_THRESHOLD_MS: STALE_RUN_THRESHOLD_ENV, NODE_ENV } =
  process.env;
const isProdEnv = NODE_ENV === "production";

/** Check interval (5 minutes) */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/** Maximum run duration before marking as stale (default 1 hour) */
const STALE_RUN_THRESHOLD_MS = STALE_RUN_THRESHOLD_ENV
  ? Number(STALE_RUN_THRESHOLD_ENV)
  : 3_600_000;

let reaperInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Find and mark stale runs as failed.
 */
async function reapStaleRuns(): Promise<void> {
  const token = await acquireReaperLock();
  if (!token) return;

  try {
    const threshold = new Date(Date.now() - STALE_RUN_THRESHOLD_MS);

    const staleRuns = await db
      .update(workflowRunTable)
      .set({
        status: "failed",
        error: "Run exceeded maximum execution time",
        completedAt: new Date().toISOString(),
      })
      .where(
        and(
          inArray(workflowRunTable.status, ["running", "pending"]),
          lte(workflowRunTable.startedAt, threshold.toISOString()),
        ),
      )
      .returning({ id: workflowRunTable.id });

    if (staleRuns.length > 0) {
      logger.info("Reaped stale runs", {
        count: staleRuns.length,
        runIds: staleRuns.map((r) => r.id),
      });
    }
  } catch (err) {
    logger.error("Error reaping stale runs", {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    await releaseReaperLock(token);
  }
}

/**
 * Start the stale run reaper.
 */
export function startStaleRunReaper(): void {
  if (reaperInterval) {
    logger.warn("Stale run reaper already running");
    return;
  }

  if (isProdEnv && !isCacheConfigured()) {
    logger.error(
      "Cache is required in production for distributed reaper locking. Set CACHE_URL to enable",
    );
    throw new Error(
      "Cache is required for stale run reaper in production to prevent duplicate reaping",
    );
  }

  if (!isCacheConfigured()) {
    logger.warn(
      "Running without cache. Stale run reaper will work but is not safe for multi-instance deployments",
    );
  }

  logger.info("Stale run reaper started", {
    checkIntervalMs: CHECK_INTERVAL_MS,
    thresholdMs: STALE_RUN_THRESHOLD_MS,
  });

  // Run immediately on start
  reapStaleRuns();

  // Schedule periodic checks
  reaperInterval = setInterval(reapStaleRuns, CHECK_INTERVAL_MS);
}

/**
 * Stop the stale run reaper.
 */
export function stopStaleRunReaper(): void {
  if (reaperInterval) {
    clearInterval(reaperInterval);
    reaperInterval = null;
    logger.info("Stale run reaper stopped");
  }
}
