/**
 * Result of deleting one batch of expired rows: how many went, and the newest
 * `recorded_at` among them (null when none were deleted)
 */
interface BatchResult {
  deleted: number;
  last: Date | null;
}

/**
 * Delete up to `limit` expired rows with `recorded_at` in `[floor, cutoff)`,
 * oldest first, as one short statement committed on its own
 */
export type DeleteBatch = (
  floor: Date | null,
  cutoff: Date,
  limit: number,
) => Promise<BatchResult>;

interface PruneOptions {
  deleteBatch: DeleteBatch;
  cutoff: Date;
  /** Lower bound to resume from (rows below it are already gone) */
  floor: Date | null;
  batchSize: number;
  maxBatches: number;
  /** Pause between batches so a backlog drain never saturates the database */
  pauseMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

interface PruneResult {
  deleted: number;
  /** Where the next sweep can resume from */
  floor: Date | null;
  /** True when the sweep stopped at `maxBatches` with expired rows left */
  capped: boolean;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Drain expired rows in keyset batches.
 *
 * Each batch starts at the newest `recorded_at` the previous batch deleted
 * instead of the start of the index. Deleted rows stay in the index as dead
 * entries until vacuum removes them, so restarting every batch from the
 * oldest entry made each one walk every row deleted so far: once a backlog
 * had been partly drained, a single batch took longer than the statement
 * timeout and the sweep never progressed again. Keyset batches stay short
 * however much has already been deleted.
 *
 * A failed batch keeps the progress made so far: the error propagates with
 * the floor reached attached as `floor` on the thrown error's `prune` field
 */
export const pruneInBatches = async ({
  deleteBatch,
  cutoff,
  floor: startFloor,
  batchSize,
  maxBatches,
  pauseMs = 0,
  sleep = defaultSleep,
}: PruneOptions): Promise<PruneResult> => {
  let floor = startFloor;
  let deleted = 0;

  for (let batch = 0; batch < maxBatches; batch++) {
    if (batch > 0 && pauseMs > 0) await sleep(pauseMs);

    let result: BatchResult;
    try {
      result = await deleteBatch(floor, cutoff, batchSize);
    } catch (error) {
      throw Object.assign(
        error instanceof Error ? error : new Error(String(error)),
        { prune: { deleted, floor } },
      );
    }

    deleted += result.deleted;
    if (result.last) floor = result.last;

    if (result.deleted < batchSize) return { deleted, floor, capped: false };
  }

  return { deleted, floor, capped: true };
};
