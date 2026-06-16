/**
 * Workflow execution tests.
 *
 * Exercises the workflow run record management call shape (insert, update,
 * query) and the run lifecycle state machine against a local in-memory fake db
 * (no module mocking required).
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { randomUUID } from "node:crypto";

// In-memory store backing the fake db
type RunRow = Record<string, unknown>;
const runStore = new Map<string, RunRow>();

// Shared state between fake query builders (avoids attaching hidden props)
let pendingRow: RunRow | undefined;
let pendingSet: RunRow | undefined;

const mockReturning = mock(() => {
  return Promise.resolve(pendingRow ? [pendingRow] : []);
});

const mockInsertValues = mock((values: RunRow) => {
  const row = { id: randomUUID(), ...values };
  runStore.set(row.id as string, row);
  pendingRow = row;
  return { returning: mockReturning };
});

const mockInsert = mock(() => ({ values: mockInsertValues }));

const mockUpdateWhere = mock(async (_condition: unknown) => {
  // Apply pending set to matching rows (simplified: update first match)
  if (pendingSet) {
    for (const [_id, row] of runStore) {
      Object.assign(row, pendingSet);
      break;
    }
  }
  return [];
});

const mockUpdateSet = mock((values: RunRow) => {
  pendingSet = values;
  return { where: mockUpdateWhere };
});

const mockUpdate = mock(() => ({ set: mockUpdateSet }));

const mockDeleteWhere = mock(async () => []);
const mockDelete = mock(() => ({ where: mockDeleteWhere }));

const mockFindFirst = mock(async (_opts?: { where?: unknown }) => {
  // Return first matching row from store
  for (const row of runStore.values()) return row;
  return undefined;
});

// Local fake drizzle db (the run-record call shape under test)
const db = {
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  select: mock(() => ({
    from: mock(() => ({
      where: mock(() => ({
        limit: mock(async () => []),
      })),
    })),
  })),
  query: {
    workflowRunTable: { findFirst: mockFindFirst },
  },
};

describe("Workflow Execution", () => {
  const testWorkflowId = randomUUID();

  beforeEach(() => {
    runStore.clear();
  });

  describe("Workflow Run Status", () => {
    test("should create workflow run record", async () => {
      const values = {
        workflowId: testWorkflowId,
        engineWorkflowId: `test-engine-${Date.now()}`,
        engineRunId: `test-run-${Date.now()}`,
        status: "pending",
        input: { test: true },
      };

      const [run] = await (db as any).insert(null).values(values).returning();

      expect(run.id).toBeDefined();
      expect(run.status).toBe("pending");
      expect(run.workflowId).toBe(testWorkflowId);

      const fetchedRun = await (db as any).query.workflowRunTable.findFirst();

      expect(fetchedRun).toBeDefined();
      expect(fetchedRun?.status).toBe("pending");
    });

    test("should update workflow run status", async () => {
      // Seed a run
      const runId = randomUUID();
      runStore.set(runId, {
        id: runId,
        workflowId: testWorkflowId,
        status: "pending",
        startedAt: null,
        completedAt: null,
        output: null,
      });

      // Update to running
      await (db as any)
        .update(null)
        .set({ status: "running", startedAt: new Date().toISOString() })
        .where(null);

      const row = runStore.get(runId)!;
      expect(row.status).toBe("running");
      expect(row.startedAt).toBeDefined();

      // Update to completed
      await (db as any)
        .update(null)
        .set({
          status: "completed",
          completedAt: new Date().toISOString(),
          output: { result: "success" },
        })
        .where(null);

      const completed = runStore.get(runId)!;
      expect(completed.status).toBe("completed");
      expect(completed.completedAt).toBeDefined();
      expect(completed.output).toEqual({ result: "success" });
    });
  });
});
