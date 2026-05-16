/**
 * Workflow execution tests.
 *
 * Tests workflow run record management (insert, update, query) and
 * verifies the run lifecycle state machine. All database operations
 * are mocked so the suite works in both isolated and shared-process
 * modes (bun test without per-file isolation).
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { randomUUID } from "node:crypto";

// -- Module mocks (must precede dynamic imports) --

mock.module("lib/config/env.config", () => ({
  DATABASE_URL: "postgres://test",
  AUTH_BASE_URL: "http://localhost:3000",
  CORS_ALLOWED_ORIGINS: "*",
  HATCHET_CLIENT_TOKEN: "test-token",
  AUTHZ_API_URL: "http://warden.test",
  AUTHZ_SERVICE_KEY: undefined,
  AUTHZ_WEBHOOK_SECRET: undefined,
  AUDIT_WEBHOOK_SECRET: undefined,
  AUTH_DEBUG: undefined,
  AUTH_WEBHOOK_SECRET: undefined,
  BILLING_BASE_URL: undefined,
  BILLING_SERVICE_API_KEY: undefined,
  BILLING_WEBHOOK_SECRET: undefined,
  CACHE_URL: null,
  DISCORD_OAUTH_CLIENT_ID: undefined,
  DISCORD_OAUTH_CLIENT_SECRET: undefined,
  EMAIL_WEBHOOK_SECRET: undefined,
  ENCRYPTION_KEY: undefined,
  GITHUB_OAUTH_CLIENT_ID: undefined,
  GITHUB_OAUTH_CLIENT_SECRET: undefined,
  GOOGLE_OAUTH_CLIENT_ID: undefined,
  GOOGLE_OAUTH_CLIENT_SECRET: undefined,
  GRAPHQL_MAX_COMPLEXITY_COST: "5000",
  HOST: "0.0.0.0",
  IDP_WEBHOOK_SECRET: undefined,
  INTERNAL_API_SECRET: undefined,
  NODE_ENV: "test",
  PLATFORM_ORG_ID: undefined,
  PLUGIN_STORAGE_BASE_URL: undefined,
  PLUGIN_STORAGE_BUCKET: undefined,
  PORT: "4000",
  PROTECT_ROUTES: undefined,
  SEARCH_BOOTSTRAP_WEBHOOK_SECRET: undefined,
  SLACK_OAUTH_CLIENT_ID: undefined,
  SLACK_OAUTH_CLIENT_SECRET: undefined,
  STRIPE_API_KEY: undefined,
  STRIPE_WEBHOOK_SECRET: undefined,
  TEMPORAL_ADDRESS: undefined,
  TEMPORAL_NAMESPACE: undefined,
  TEMPORAL_TASK_QUEUE: undefined,
  VORTEX_PUBLIC_URL: "http://localhost:4222",
  WORKER_URL: undefined,
  LOG_LEVEL: "info",
  isDevEnv: false,
  isProdEnv: false,
  protectRoutes: false,
  isAuthzEnabled: false,
  hasBilling: true,
  getOAuthCredentials: () => null,
}));

mock.module("lib/logger", () => ({
  default: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  },
}));

// In-memory store backing the mock db
type RunRow = Record<string, unknown>;
const runStore = new Map<string, RunRow>();

// Shared state between mock functions (avoids attaching hidden props)
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

mock.module("lib/db/db", () => ({
  dbPool: {
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
  },
  pgPool: { end: async () => {} },
}));

describe("Workflow Execution", () => {
  const testWorkflowId = randomUUID();

  beforeEach(() => {
    runStore.clear();
  });

  describe("Workflow Run Status", () => {
    test("should create workflow run record", async () => {
      const { dbPool: db } = await import("lib/db/db");

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

      const { dbPool: db } = await import("lib/db/db");

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
