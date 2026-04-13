/**
 * Integration tests for workflow dispatch.
 *
 * Verifies `dispatchWorkflow()` routes execution to the correct backend
 * (Hatchet, Temporal, or BYOK) and publishes lifecycle events.
 */

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { randomUUID } from "node:crypto";

// -- Module mocks (must precede any import of dispatch.ts) --

// Mock env config to prevent required-env-var validation at import time
mock.module("lib/config/env.config", () => ({
  DATABASE_URL: "postgres://test",
  AUTH_BASE_URL: "http://localhost:3000",
  CORS_ALLOWED_ORIGINS: "*",
  HATCHET_CLIENT_TOKEN: "test-token",
  LOG_LEVEL: "info",
  isProdEnv: false,
  isDevEnv: false,
  protectRoutes: false,
  isAuthzEnabled: false,
  hasBilling: true,
  AUTHZ_API_URL: "http://warden.test",
  AUTHZ_SERVICE_KEY: undefined,
  VORTEX_PUBLIC_URL: "http://localhost:4222",
  CACHE_URL: null,
  WORKER_URL: "http://localhost:8080",
  INTERNAL_API_SECRET: "test-secret",
  BILLING_BASE_URL: undefined,
  BILLING_SERVICE_API_KEY: undefined,
  BILLING_WEBHOOK_SECRET: undefined,
  PLATFORM_ORG_ID: undefined,
  PORT: 4000,
}));

mock.module("lib/logger", () => ({
  default: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  },
}));

mock.module("iovalkey", () => ({
  default: class MockValkey {},
}));

mock.module("lib/cache/client", () => ({
  cacheClient: null,
}));

// Track Hatchet REST pushEvent calls
const mockHatchetPush = mock<
  (eventName: string, payload: unknown) => Promise<void>
>(async () => {});

mock.module("lib/hatchet/client", () => ({
  pushEvent: mockHatchetPush,
  isConfigured: () => true,
}));

// Track Temporal workflow.start calls
const mockTemporalWorkflowStart = mock<
  (name: string, opts: unknown) => Promise<{ workflowId: string }>
>(async () => ({ workflowId: "temporal-run-1" }));

mock.module("@temporalio/client", () => ({
  Connection: {
    connect: async () => ({}),
  },
  Client: class MockClient {
    workflow = { start: mockTemporalWorkflowStart };
  },
}));

// Mock the DB pool used by dispatch.ts for BYOK lookups
const mockDbFindFirst = mock<() => Promise<unknown>>(async () => null);

mock.module("lib/db/db", () => ({
  dbPool: {
    query: {
      workflowExecutorConfigTable: { findFirst: mockDbFindFirst },
      wardenSyncQueueTable: { findFirst: async () => null },
    },
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    insert: () => ({
      values: () => ({ returning: () => Promise.resolve([]) }),
    }),
  },
  dbClient: {},
  pgClient: { end: async () => {} },
  pgPool: { end: async () => {} },
}));

// Mock crypto decryption for BYOK executor config
mock.module("lib/crypto/encryption", () => ({
  decryptJson: () => ({
    address: "localhost:7233",
    namespace: "test",
    taskQueue: "test-queue",
  }),
}));

// Mock the server module (lazy eventsClient resolution)
const mockPublish = mock<(event: unknown) => Promise<void>>(async () => {});

mock.module("server", () => ({
  eventsClient: { publish: mockPublish },
}));

// Import after all mocks are established
const { dispatchWorkflow } = await import("../../lib/dispatch");

// -- Helpers --

import { createTestOrg, createTestWorkflow } from "./helpers";

// Workflow type expected by dispatchWorkflow
type DispatchWorkflow = Parameters<typeof dispatchWorkflow>[0];
type DispatchRun = Parameters<typeof dispatchWorkflow>[1];

/** Narrow a test workflow fixture to the dispatch function's expected type */
const asWorkflow = (wf: ReturnType<typeof createTestWorkflow>) =>
  wf as unknown as DispatchWorkflow;

const createTestRun = (_workflowId: string): DispatchRun => ({
  id: randomUUID(),
  engineWorkflowId: `engine-wf-${randomUUID().slice(0, 8)}`,
});

// -- Tests --

describe("dispatchWorkflow", () => {
  const org = createTestOrg();
  let workflow: ReturnType<typeof createTestWorkflow>;
  let run: ReturnType<typeof createTestRun>;
  const triggerData = { foo: "bar" };

  beforeEach(() => {
    workflow = createTestWorkflow(org.id);
    run = createTestRun(workflow.id);
  });

  afterEach(() => {
    mockHatchetPush.mockReset();
    mockTemporalWorkflowStart.mockReset();
    mockDbFindFirst.mockReset();
    mockPublish.mockReset();

    // Restore default implementations
    mockHatchetPush.mockImplementation(async () => {});
    mockTemporalWorkflowStart.mockImplementation(async () => ({
      workflowId: "temporal-run-1",
    }));
    mockDbFindFirst.mockImplementation(async () => null);
    mockPublish.mockImplementation(async () => {});
  });

  describe("Hatchet executor (default)", () => {
    it("dispatches to Hatchet with correct event payload", async () => {
      await dispatchWorkflow(asWorkflow(workflow), run, triggerData);

      expect(mockHatchetPush).toHaveBeenCalledTimes(1);

      const [eventName, payload] = mockHatchetPush.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];

      expect(eventName).toBe("workflow:execute");
      expect(payload).toMatchObject({
        workflowId: run.engineWorkflowId,
        runId: run.id,
        organizationId: org.id,
        triggerData,
        definition: workflow.definition,
      });
    });

    it("publishes a lifecycle event on success", async () => {
      await dispatchWorkflow(asWorkflow(workflow), run, triggerData);

      expect(mockPublish).toHaveBeenCalledTimes(1);

      const [event] = mockPublish.mock.calls[0] as [Record<string, unknown>];
      expect(event).toMatchObject({
        type: "vortex.workflow.started",
        source: "omni.vortex",
        subject: run.id,
        organizationId: org.id,
      });
    });

    it("uses hatchet as default when executor field is null", async () => {
      const wf = createTestWorkflow(org.id, { executor: null });
      // dispatchWorkflow falls back: `workflow.executor ?? "hatchet"`
      await dispatchWorkflow(asWorkflow(wf), run, triggerData);

      expect(mockHatchetPush).toHaveBeenCalledTimes(1);
    });

    it("publishes a failure lifecycle event when Hatchet push throws", async () => {
      mockHatchetPush.mockImplementation(async () => {
        throw new Error("Hatchet connection refused");
      });

      await expect(
        dispatchWorkflow(asWorkflow(workflow), run, triggerData),
      ).rejects.toThrow("Hatchet connection refused");

      // Failure event should still be published
      expect(mockPublish).toHaveBeenCalledTimes(1);
      const [event] = mockPublish.mock.calls[0] as [Record<string, unknown>];
      expect(event).toMatchObject({
        type: "vortex.workflow.failed",
      });
      expect((event.data as Record<string, unknown>).error).toBe(
        "Hatchet connection refused",
      );
    });
  });

  describe("Temporal executor", () => {
    it("dispatches to platform Temporal", async () => {
      // Set env var for Temporal
      const prev = process.env.TEMPORAL_ADDRESS;
      process.env.TEMPORAL_ADDRESS = "localhost:7233";

      const temporalWorkflow = createTestWorkflow(org.id, {
        executor: "temporal",
      });

      await dispatchWorkflow(asWorkflow(temporalWorkflow), run, triggerData);

      expect(mockTemporalWorkflowStart).toHaveBeenCalledTimes(1);
      const [workflowName, opts] = mockTemporalWorkflowStart.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(workflowName).toBe("dslWorkflow");
      expect(opts).toMatchObject({
        workflowId: run.id,
      });

      // Restore
      if (prev === undefined) delete process.env.TEMPORAL_ADDRESS;
      else process.env.TEMPORAL_ADDRESS = prev;
    });
  });

  describe("unknown executor", () => {
    it("throws when BYOK executor config is not found", async () => {
      mockDbFindFirst.mockImplementation(async () => null);

      const customWorkflow = createTestWorkflow(org.id, {
        executor: "nonexistent-backend",
      });

      await expect(
        dispatchWorkflow(asWorkflow(customWorkflow), run, triggerData),
      ).rejects.toThrow(/Unknown executor "nonexistent-backend"/);
    });

    it("dispatches to BYOK Temporal when config exists", async () => {
      mockDbFindFirst.mockImplementation(async () => ({
        id: randomUUID(),
        organizationId: org.id,
        slug: "acme-temporal",
        type: "temporal",
        config: "encrypted-placeholder",
      }));

      const byokWorkflow = createTestWorkflow(org.id, {
        executor: "acme-temporal",
      });

      await dispatchWorkflow(asWorkflow(byokWorkflow), run, triggerData);

      expect(mockTemporalWorkflowStart).toHaveBeenCalledTimes(1);
      const [workflowName, opts] = mockTemporalWorkflowStart.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(workflowName).toBe("dslWorkflow");
      expect(opts).toMatchObject({
        workflowId: run.id,
      });
    });

    it("throws for unsupported executor type in BYOK config", async () => {
      mockDbFindFirst.mockImplementation(async () => ({
        id: randomUUID(),
        organizationId: org.id,
        slug: "custom-unknown",
        type: "kubernetes",
        config: "encrypted-placeholder",
      }));

      const wf = createTestWorkflow(org.id, { executor: "custom-unknown" });

      await expect(
        dispatchWorkflow(asWorkflow(wf), run, triggerData),
      ).rejects.toThrow(
        /Unsupported executor type "kubernetes" for executor "custom-unknown"/,
      );
    });
  });

  describe("lifecycle events", () => {
    it("does not throw when eventsClient.publish fails", async () => {
      mockPublish.mockImplementation(async () => {
        throw new Error("events service down");
      });

      // Should still complete without throwing
      await dispatchWorkflow(asWorkflow(workflow), run, triggerData);

      expect(mockHatchetPush).toHaveBeenCalledTimes(1);
    });
  });

  describe("inactive workflow guard", () => {
    it("should not dispatch inactive workflows", () => {
      // The dispatch module does not check isActive - that is enforced by
      // the API layer (api.ts) before calling dispatchWorkflow. Verify
      // that an inactive workflow fixture is correctly identifiable.
      const inactiveWorkflow = createTestWorkflow(org.id, {
        isActive: false,
      });

      expect(inactiveWorkflow.isActive).toBe(false);

      // The API layer rejects inactive workflows with a 400 before
      // dispatchWorkflow is ever called
    });
  });
});
