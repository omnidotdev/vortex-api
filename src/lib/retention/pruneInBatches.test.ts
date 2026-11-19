import { describe, expect, test } from "bun:test";

import { pruneInBatches } from "./pruneInBatches";

import type { DeleteBatch } from "./pruneInBatches";

const day = (n: number) => new Date(Date.UTC(2026, 7, n));

/**
 * In-memory event_log: expired rows sorted by recorded_at. Records the floor
 * each batch was asked to start from, so the tests can check that batches
 * resume where the previous one stopped instead of rescanning from the start
 */
const fakeTable = (recordedAt: Date[]) => {
  let rows = [...recordedAt].sort((a, b) => a.getTime() - b.getTime());
  const floors: (Date | null)[] = [];

  const deleteBatch: DeleteBatch = async (floor, cutoff, limit) => {
    floors.push(floor);
    const batch = rows
      .filter((r) => r < cutoff && (!floor || r >= floor))
      .slice(0, limit);
    rows = rows.filter((r) => !batch.includes(r));

    return { deleted: batch.length, last: batch.at(-1) ?? null };
  };

  return { deleteBatch, floors, remaining: () => rows };
};

describe("pruneInBatches", () => {
  test("drains every expired row and leaves newer ones", async () => {
    const table = fakeTable([day(1), day(2), day(3), day(4), day(5), day(20)]);

    const result = await pruneInBatches({
      deleteBatch: table.deleteBatch,
      cutoff: day(10),
      floor: null,
      batchSize: 2,
      maxBatches: 10,
    });

    expect(result).toEqual({ deleted: 5, floor: day(5), capped: false });
    expect(table.remaining()).toEqual([day(20)]);
  });

  test("starts each batch at the last deleted recorded_at (keyset)", async () => {
    const table = fakeTable([day(1), day(2), day(3), day(4), day(5)]);

    await pruneInBatches({
      deleteBatch: table.deleteBatch,
      cutoff: day(10),
      floor: null,
      batchSize: 2,
      maxBatches: 10,
    });

    expect(table.floors).toEqual([null, day(2), day(4)]);
  });

  test("resumes from a previous sweep's floor", async () => {
    const table = fakeTable([day(6), day(7)]);

    const result = await pruneInBatches({
      deleteBatch: table.deleteBatch,
      cutoff: day(10),
      floor: day(5),
      batchSize: 10,
      maxBatches: 10,
    });

    expect(table.floors).toEqual([day(5)]);
    expect(result.floor).toEqual(day(7));
  });

  test("keeps rows sharing the floor's timestamp eligible", async () => {
    // Ties at the boundary must not be skipped by the next batch
    const same = day(3);
    const table = fakeTable([day(1), same, new Date(same), new Date(same)]);

    const result = await pruneInBatches({
      deleteBatch: table.deleteBatch,
      cutoff: day(10),
      floor: null,
      batchSize: 2,
      maxBatches: 10,
    });

    expect(result.deleted).toBe(4);
    expect(table.remaining()).toEqual([]);
  });

  test("stops at maxBatches and reports the backlog", async () => {
    const table = fakeTable([day(1), day(2), day(3), day(4), day(5)]);

    const result = await pruneInBatches({
      deleteBatch: table.deleteBatch,
      cutoff: day(10),
      floor: null,
      batchSize: 1,
      maxBatches: 2,
    });

    expect(result).toEqual({ deleted: 2, floor: day(2), capped: true });
    expect(table.remaining()).toHaveLength(3);
  });

  test("does nothing past an empty first batch", async () => {
    const table = fakeTable([day(20)]);

    const result = await pruneInBatches({
      deleteBatch: table.deleteBatch,
      cutoff: day(10),
      floor: null,
      batchSize: 5,
      maxBatches: 5,
    });

    expect(result).toEqual({ deleted: 0, floor: null, capped: false });
    expect(table.floors).toHaveLength(1);
  });

  test("pauses between batches, not before the first", async () => {
    const table = fakeTable([day(1), day(2), day(3)]);
    const pauses: number[] = [];

    await pruneInBatches({
      deleteBatch: table.deleteBatch,
      cutoff: day(10),
      floor: null,
      batchSize: 1,
      maxBatches: 10,
      pauseMs: 100,
      sleep: async (ms) => {
        pauses.push(ms);
      },
    });

    // 4 batches (the last finds nothing), 3 pauses
    expect(pauses).toEqual([100, 100, 100]);
  });

  test("a failed batch keeps the progress made before it", async () => {
    const table = fakeTable([day(1), day(2), day(3)]);
    let calls = 0;
    const flaky: DeleteBatch = async (floor, cutoff, limit) => {
      calls += 1;
      if (calls === 2)
        throw new Error("canceling statement due to statement timeout");
      return table.deleteBatch(floor, cutoff, limit);
    };

    const error = await pruneInBatches({
      deleteBatch: flaky,
      cutoff: day(10),
      floor: null,
      batchSize: 1,
      maxBatches: 10,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as { prune: unknown }).prune).toEqual({
      deleted: 1,
      floor: day(1),
    });
  });
});
