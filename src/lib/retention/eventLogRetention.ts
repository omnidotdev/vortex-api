/**
 * Event Log Retention Sweep
 *
 * Periodically deletes `event_log` rows older than the configured retention
 * window, in bounded batches, so the table (and the vortex-db volume) cannot
 * grow without limit. This matters most for self-hosted Vortex, where a single
 * modest volume otherwise fills over time and crash-loops the database.
 *
 * Controlled by `EVENT_LOG_RETENTION_DAYS` (default 90). Set it to 0 or a
 * negative value to disable pruning (keep events forever). Deletes are
 * idempotent, so the sweep is safe without cache (single-instance mode) and
 * when instances race; a cache lock, when configured, just avoids redundant
 * work across replicas.
 *
 * Note: events older than the retention window can no longer be replayed
 * (`POST /api/v1/events/replay` reads from `event_log`).
 */

import { sql } from "drizzle-orm";

import {
  acquireRetentionLock,
  isCacheConfigured,
  releaseRetentionLock,
} from "lib/cache";
import { dbPool as db } from "lib/db/db";
import { eventLogTable } from "lib/db/schema";
import logger from "lib/logger";

const { EVENT_LOG_RETENTION_DAYS: RETENTION_DAYS_ENV } = process.env;

/** How often to sweep (6 hours) */
const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Rows deleted per batch, to keep each statement short and lock-light */
const BATCH_SIZE = 5_000;

/** Safety cap on batches per tick, against a runaway loop */
const MAX_BATCHES_PER_SWEEP = 500;

/** Days of event_log history to retain (default 90); <= 0 disables pruning */
const RETENTION_DAYS = RETENTION_DAYS_ENV ? Number(RETENTION_DAYS_ENV) : 90;

const pruningDisabled = !Number.isFinite(RETENTION_DAYS) || RETENTION_DAYS <= 0;

let sweepInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Delete expired event_log rows in bounded batches.
 */
async function sweepEventLog(): Promise<void> {
  if (pruningDisabled) return;

  const token = await acquireRetentionLock();
  if (!token) return;

  try {
    const cutoff = new Date(
      Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    let totalDeleted = 0;
    for (let batch = 0; batch < MAX_BATCHES_PER_SWEEP; batch++) {
      // Delete a bounded batch of the oldest expired rows. The ctid subquery
      // with LIMIT keeps each DELETE short (Postgres DELETE has no LIMIT), so
      // the sweep never holds a long lock or builds one huge transaction.
      const result = await db.execute(sql`
        DELETE FROM ${eventLogTable}
        WHERE ctid IN (
          SELECT ctid FROM ${eventLogTable}
          WHERE ${eventLogTable.recordedAt} < ${cutoff}
          LIMIT ${BATCH_SIZE}
        )
      `);

      const deleted = result.rowCount ?? 0;
      totalDeleted += deleted;
      if (deleted < BATCH_SIZE) break;
    }

    if (totalDeleted > 0) {
      logger.info("Pruned expired event_log rows", {
        deleted: totalDeleted,
        retentionDays: RETENTION_DAYS,
        cutoff,
      });
    }
  } catch (err) {
    logger.error("Error pruning event_log", {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    await releaseRetentionLock(token);
  }
}

/**
 * Start the event-log retention sweep.
 */
export function startEventLogRetention(): void {
  if (sweepInterval) {
    logger.warn("Event log retention sweep already running");
    return;
  }

  if (pruningDisabled) {
    logger.warn(
      "EVENT_LOG_RETENTION_DAYS <= 0, event_log pruning disabled (events kept forever)",
    );
    return;
  }

  if (!isCacheConfigured()) {
    logger.warn(
      "Running event_log retention without cache (single-instance mode); safe because deletes are idempotent",
    );
  }

  logger.info("Event log retention sweep started", {
    retentionDays: RETENTION_DAYS,
    sweepIntervalMs: SWEEP_INTERVAL_MS,
  });

  // Defer the first sweep so it does not compete with startup/migration work.
  setTimeout(sweepEventLog, 60_000).unref?.();
  sweepInterval = setInterval(sweepEventLog, SWEEP_INTERVAL_MS);
  sweepInterval.unref?.();
}

/**
 * Stop the event-log retention sweep.
 */
export function stopEventLogRetention(): void {
  if (sweepInterval) {
    clearInterval(sweepInterval);
    sweepInterval = null;
    logger.info("Event log retention sweep stopped");
  }
}
