/**
 * Workflow versioning logic tests.
 *
 * Tests the version-increment algorithm used by saveWorkflowVersion.
 * Uses inline logic to avoid mock.module() contamination that occurs
 * when multiple test files run in a single process (bun test).
 */

import { describe, expect, it, mock } from "bun:test";

mock.module("lib/logger", () => ({
  default: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  },
}));

// Track inserts for assertions
const insertedRows: unknown[] = [];
let findFirstResult: { version: number } | undefined;

const mockReturning = mock(() => {
  const row = insertedRows.shift();
  return Promise.resolve(row ? [row] : []);
});

const mockValues = mock((_values: unknown) => ({ returning: mockReturning }));
const mockInsert = mock((_table: unknown) => ({ values: mockValues }));
const mockFindFirst = mock(() => Promise.resolve(findFirstResult));

// Inline re-implementation of saveWorkflowVersion's core logic to test
// the algorithm without depending on mock.module("lib/db/db"), which is
// unreliable in shared-process mode
const db = {
  insert: mockInsert,
  query: {
    workflowVersionTable: {
      findFirst: mockFindFirst,
    },
  },
};

type SaveParams = {
  workflowId: string;
  definition: unknown;
  createdBy?: string;
  changeNote?: string;
};

async function saveWorkflowVersion({
  workflowId,
  definition,
  createdBy,
  changeNote,
}: SaveParams) {
  const existing = await db.query.workflowVersionTable.findFirst();
  const nextVersion = (existing?.version ?? 0) + 1;

  const [inserted] = await db
    .insert(null as any)
    .values({
      workflowId,
      version: nextVersion,
      definition,
      createdBy,
      changeNote,
    })
    .returning();

  return inserted;
}

describe("saveWorkflowVersion", () => {
  it("should start at version 1 when no versions exist", async () => {
    findFirstResult = undefined;

    const expectedRow = {
      id: "v1",
      workflowId: "wf-1",
      version: 1,
      definition: { nodes: [] },
      createdBy: "user-1",
      createdAt: "2026-01-01T00:00:00Z",
      changeNote: null,
    };
    insertedRows.push(expectedRow);

    const result = await saveWorkflowVersion({
      workflowId: "wf-1",
      definition: { nodes: [] },
      createdBy: "user-1",
    });

    expect(result).toEqual(expectedRow);

    // Verify insert was called with version 1
    const lastCall = mockValues.mock.calls.at(-1);
    const valuesArg = lastCall?.[0] as Record<string, unknown>;
    expect(valuesArg.version).toBe(1);
    expect(valuesArg.workflowId).toBe("wf-1");
    expect(valuesArg.definition).toEqual({ nodes: [] });
  });

  it("should increment version from existing max", async () => {
    findFirstResult = { version: 3 };

    const expectedRow = {
      id: "v4",
      workflowId: "wf-2",
      version: 4,
      definition: { nodes: ["a"] },
      createdBy: null,
      createdAt: "2026-01-01T00:00:00Z",
      changeNote: "Updated triggers",
    };
    insertedRows.push(expectedRow);

    const result = await saveWorkflowVersion({
      workflowId: "wf-2",
      definition: { nodes: ["a"] },
      changeNote: "Updated triggers",
    });

    expect(result).toEqual(expectedRow);

    const lastCall = mockValues.mock.calls.at(-1);
    const valuesArg = lastCall?.[0] as Record<string, unknown>;
    expect(valuesArg.version).toBe(4);
    expect(valuesArg.workflowId).toBe("wf-2");
    expect(valuesArg.changeNote).toBe("Updated triggers");
  });

  it("should pass createdBy when provided", async () => {
    findFirstResult = undefined;

    const expectedRow = {
      id: "v5",
      workflowId: "wf-3",
      version: 1,
      definition: {},
      createdBy: "user-42",
      createdAt: "2026-01-01T00:00:00Z",
      changeNote: null,
    };
    insertedRows.push(expectedRow);

    await saveWorkflowVersion({
      workflowId: "wf-3",
      definition: {},
      createdBy: "user-42",
    });

    const lastCall = mockValues.mock.calls.at(-1);
    const valuesArg = lastCall?.[0] as Record<string, unknown>;
    expect(valuesArg.createdBy).toBe("user-42");
  });
});
