/**
 * Event Log Retention Sweep
 *
 * Periodically deletes `event_log` rows older than the configured retention
 * window, in short keyset batches (see `pruneInBatches`), so the table (and the vortex-db volume) cannot
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
import { pruneInBatches } from "lib/retention/pruneInBatches";

import type { DeleteBatch } from "lib/retention/pruneInBatches";

const { EVENT_LOG_RETENTION_DAYS: RETENTION_DAYS_ENV } = process.env;

/** How often to sweep (6 hours) */
const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Rows deleted per batch. Small enough that one batch (index range read, heap
 * deletes, index maintenance on six indexes) finishes well inside the pool's
 * 10s statement timeout on a cold cache
 */
const BATCH_SIZE = 1_000;

/** Safety cap on batches per sweep (bounds one sweep to 500k rows) */
const MAX_BATCHES_PER_SWEEP = 500;

/** Pause between batches so draining a backlog never saturates the database */
const BATCH_PAUSE_MS = 100;

/** Days of event_log history to retain (default 90); <= 0 disables pruning */
const RETENTION_DAYS = RETENTION_DAYS_ENV ? Number(RETENTION_DAYS_ENV) : 90;

const pruningDisabled = !Number.isFinite(RETENTION_DAYS) || RETENTION_DAYS <= 0;

let sweepInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Newest `recorded_at` already pruned in this process. Rows are appended with
 * `recorded_at = now()`, so nothing expired is ever inserted below it, and the
 * next sweep resumes here instead of walking the dead index entries its
 * predecessors left behind. Resets on restart (the first batch then starts at
 * the oldest row, which autovacuum keeps cheap)
 */
let prunedFloor: Date | null = null;

/**
 * Keyset batch delete: read the oldest `limit` expired rows from the
 * `recorded_at` index starting at `floor`, delete them by ctid (TID scan),
 * and return how many went and the newest `recorded_at` deleted
 */
const buildDeleteBatchQuery = (
  floor: Date | null,
  cutoff: Date,
  limit: number,
) => sql`
  WITH batch AS (
    SELECT ctid FROM ${eventLogTable}
    WHERE ${eventLogTable.recordedAt} < ${cutoff.toISOString()}
      ${floor ? sql`AND ${eventLogTable.recordedAt} >= ${floor.toISOString()}` : sql``}
    ORDER BY ${eventLogTable.recordedAt}
    LIMIT ${limit}
  ),
  deleted AS (
    DELETE FROM ${eventLogTable}
    WHERE ctid IN (SELECT ctid FROM batch)
    RETURNING ${eventLogTable.recordedAt} AS recorded_at
  )
  SELECT count(*)::int AS deleted, max(recorded_at) AS last FROM deleted
`;

/**
 * Delete one keyset batch of expired rows, oldest first, starting at `floor`.
 * Runs as a single autocommitted statement, so each batch commits on its own
 * and holds its row locks only for its own short duration
 */
const deleteEventLogBatch: DeleteBatch = async (
  floor,
  cutoff,
  limit,
) => {
  const result = await db.execute<{ deleted: number; last: string | null }>(
    buildDeleteBatchQuery(floor, cutoff, limit),
  );
  const row = result.rows[0];

  return {
    deleted: Number(row?.deleted ?? 0),
    last: row?.last ? new Date(row.last) : null,
  };
};

/**
 * Delete expired event_log rows in keyset batches.
 */
async function sweepEventLog(): Promise<void> {
  if (pruningDisabled) return;

  const token = await acquireRetentionLock();
  if (!token) return;

  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const { deleted, floor, capped } = await pruneInBatches({
      deleteBatch: deleteEventLogBatch,
      cutoff,
      floor: prunedFloor,
      batchSize: BATCH_SIZE,
      maxBatches: MAX_BATCHES_PER_SWEEP,
      pauseMs: BATCH_PAUSE_MS,
    });
    prunedFloor = floor;

    if (deleted > 0) {
      logger.info("Pruned expired event_log rows", {
        deleted,
        retentionDays: RETENTION_DAYS,
        cutoff: cutoff.toISOString(),
        backlogRemaining: capped,
      });
    }
  } catch (err) {
    const progress = (
      err as { prune?: { deleted: number; floor: Date | null } }
    ).prune;
    if (progress) prunedFloor = progress.floor;

    logger.error("Error pruning event_log", {
      error: err instanceof Error ? err.message : String(err),
      deletedBeforeError: progress?.deleted ?? 0,
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
