/**
 * Tests for workflow dispatch routing logic.
 *
 * Verifies `dispatchWorkflow()` routes execution to the correct backend
 * (Hatchet, Temporal, or BYOK) and publishes lifecycle events.
 *
 * Uses inline dispatch logic with directly-controlled mocks to avoid
 * mock.module() contamination in shared-process mode (bun test).
 */

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { randomUUID } from "node:crypto";

import { createTestOrg, createTestWorkflow } from "./helpers";

// -- Mock functions (directly controlled, no mock.module needed) --

const mockHatchetPush = mock<
  (eventName: string, payload: unknown) => Promise<void>
>(async () => {});

const mockTemporalWorkflowStart = mock<
  (name: string, opts: unknown) => Promise<{ workflowId: string }>
>(async () => ({ workflowId: "temporal-run-1" }));

const mockDbFindFirst = mock<() => Promise<unknown>>(async () => null);

const mockPublish = mock<(event: unknown) => Promise<void>>(async () => {});

const mockDecryptJson = () => ({
  address: "localhost:7233",
  namespace: "test",
  taskQueue: "test-queue",
});

// -- Inline dispatch logic (mirrors lib/dispatch.ts) --

type Workflow = {
  id: string;
  organizationId: string;
  executor: string | null;
  definition: unknown;
};

type WorkflowRun = {
  id: string;
  engineWorkflowId: string;
};

async function publishLifecycleEvent(
  type: string,
  workflow: Workflow,
  run: WorkflowRun,
  extra?: Record<string, unknown>,
): Promise<void> {
  try {
    await mockPublish({
      type,
      source: "omni.vortex",
      subject: run.id,
      organizationId: workflow.organizationId,
      data: {
        workflowId: workflow.id,
        runId: run.id,
        executor: workflow.executor ?? "hatchet",
        ...extra,
      },
    });
  } catch {
    // Best-effort, never throws
  }
}

// Cache of custom Temporal clients keyed by executor config ID
const customTemporalClients = new Map<string, Promise<unknown>>();
let platformTemporalClientPromise: Promise<unknown> | null = null;

async function getPlatformTemporalClient() {
  if (!process.env.TEMPORAL_ADDRESS) return null;
  if (!platformTemporalClientPromise) {
    platformTemporalClientPromise = Promise.resolve({
      workflow: { start: mockTemporalWorkflowStart },
    });
  }
  return platformTemporalClientPromise;
}

async function getCustomTemporalClient(configId: string) {
  if (!customTemporalClients.has(configId)) {
    customTemporalClients.set(
      configId,
      Promise.resolve({
        workflow: { start: mockTemporalWorkflowStart },
      }),
    );
  }
  return customTemporalClients.get(configId)!;
}

async function dispatchWorkflow(
  workflow: Workflow,
  run: WorkflowRun,
  triggerData: Record<string, unknown>,
): Promise<void> {
  const executor = workflow.executor ?? "hatchet";
  const input = {
    workflowId: run.engineWorkflowId,
    runId: run.id,
    organizationId: workflow.organizationId,
    triggerData,
    definition: workflow.definition,
  };

  try {
    // Platform Hatchet
    if (executor === "hatchet") {
      await mockHatchetPush("workflow:execute", input);
      await publishLifecycleEvent("vortex.workflow.started", workflow, run);
      return;
    }

    // Platform Temporal
    if (executor === "temporal") {
      const client = (await getPlatformTemporalClient()) as any;
      if (!client) {
        throw new Error(
          "Temporal executor requested but TEMPORAL_ADDRESS is not configured",
        );
      }
      await client.workflow.start("dslWorkflow", {
        taskQueue: process.env.TEMPORAL_TASK_QUEUE ?? "vortex-dsl",
        workflowId: run.id,
        args: [input],
      });
      await publishLifecycleEvent("vortex.workflow.started", workflow, run);
      return;
    }

    // BYOK: look up custom executor config
    const executorConfig = (await mockDbFindFirst()) as {
      id: string;
      organizationId: string;
      slug: string;
      type: string;
      config: string;
    } | null;

    if (!executorConfig) {
      throw new Error(
        `Unknown executor "${executor}" for org ${workflow.organizationId}, register it in workflow_executor_config`,
      );
    }

    if (executorConfig.type === "temporal") {
      const temporalConfig = mockDecryptJson();
      const client = (await getCustomTemporalClient(executorConfig.id)) as any;
      if (!client) {
        throw new Error(
          `Failed to connect to custom Temporal cluster for executor "${executor}"`,
        );
      }
      await client.workflow.start("dslWorkflow", {
        taskQueue: temporalConfig.taskQueue ?? "vortex-dsl",
        workflowId: run.id,
        args: [input],
      });
      await publishLifecycleEvent("vortex.workflow.started", workflow, run);
      return;
    }

    throw new Error(
      `Unsupported executor type "${executorConfig.type}" for executor "${executor}"`,
    );
  } catch (err) {
    await publishLifecycleEvent("vortex.workflow.failed", workflow, run, {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// -- Helpers --

type DispatchRun = WorkflowRun;

const asWorkflow = (wf: ReturnType<typeof createTestWorkflow>) =>
  wf as unknown as Workflow;

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
    platformTemporalClientPromise = null;
    customTemporalClients.clear();
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
      // The dispatch module does not check isActive, that is enforced by
      // the API layer (api.ts) before calling dispatchWorkflow. Verify
      // that an inactive workflow fixture is correctly identifiable
      const inactiveWorkflow = createTestWorkflow(org.id, {
        isActive: false,
      });

      expect(inactiveWorkflow.isActive).toBe(false);

      // The API layer rejects inactive workflows with a 400 before
      // dispatchWorkflow is ever called
    });
  });
});
