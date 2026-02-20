import { describe, expect, it, mock } from "bun:test";

// Mock env config and logger to avoid required-env-var validation at import time
mock.module("lib/config/env.config", () => ({
  DATABASE_URL: "postgres://test",
  LOG_LEVEL: "info",
  isProdEnv: false,
}));

mock.module("lib/logger", () => ({
  default: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    child: () => ({
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }),
  },
}));

// Mock Hatchet and Temporal before importing dispatch
const mockHatchetPush = mock(async () => {});
const mockTemporalStart = mock(async () => ({ workflowId: "wf-123" }));

mock.module("@hatchet-dev/typescript-sdk", () => ({
  default: {
    init: () => ({
      event: { push: mockHatchetPush },
    }),
  },
}));

mock.module("@temporalio/client", () => ({
  Client: class {
    workflow = { start: mockTemporalStart };
  },
  Connection: {
    connect: async () => ({}),
  },
}));

const mockDbFind = mock(
  async (): Promise<{ id: string; type: string; config: string } | null> =>
    null,
); // default: config not found

mock.module("lib/db/db", () => ({
  dbPool: {
    query: {
      workflowExecutorConfigTable: {
        findFirst: mockDbFind,
      },
    },
  },
}));

mock.module("lib/crypto/encryption", () => ({
  decryptJson: (ciphertext: string) => JSON.parse(ciphertext),
}));

// Import after mocks
const { dispatchWorkflow } = await import("../lib/dispatch");

describe("dispatchWorkflow", () => {
  const baseRun = {
    id: "run-abc",
    engineWorkflowId: "eng-wf-123",
  };

  const baseTriggerData = { trigger: "test" };

  it("routes to Hatchet when executor is 'hatchet'", async () => {
    const workflow = {
      id: "wf-1",
      organizationId: "org-1",
      definition: {},
      executor: "hatchet",
    };

    await dispatchWorkflow(workflow as any, baseRun as any, baseTriggerData);

    expect(mockHatchetPush).toHaveBeenCalledTimes(1);
    expect(mockTemporalStart).not.toHaveBeenCalled();
    mockHatchetPush.mockClear();
  });

  it("routes to Temporal when executor is 'temporal'", async () => {
    // Set TEMPORAL_ADDRESS so getTemporalClient() attempts to connect
    process.env.TEMPORAL_ADDRESS = "localhost:7233";

    const workflow = {
      id: "wf-2",
      organizationId: "org-2",
      definition: {},
      executor: "temporal",
    };

    await dispatchWorkflow(workflow as any, baseRun as any, baseTriggerData);

    expect(mockTemporalStart).toHaveBeenCalledTimes(1);
    mockTemporalStart.mockClear();
    delete process.env.TEMPORAL_ADDRESS;
  });

  it("throws for unknown executor when no config exists", async () => {
    mockDbFind.mockResolvedValueOnce(null);

    const workflow = {
      id: "wf-3",
      organizationId: "org-3",
      definition: {},
      executor: "unknown-executor",
    };

    await expect(
      dispatchWorkflow(workflow as any, baseRun as any, baseTriggerData),
    ).rejects.toThrow('Unknown executor "unknown-executor"');
  });

  it("routes to custom Temporal when executor config exists", async () => {
    process.env.TEMPORAL_ADDRESS = undefined as any;
    mockDbFind.mockResolvedValueOnce({
      id: "cfg-1",
      type: "temporal",
      config: JSON.stringify({
        address: "custom.temporal.io:7233",
        namespace: "acme",
      }),
    });

    const workflow = {
      id: "wf-4",
      organizationId: "org-4",
      definition: {},
      executor: "acme-temporal",
    };

    await dispatchWorkflow(workflow as any, baseRun as any, baseTriggerData);

    expect(mockTemporalStart).toHaveBeenCalledTimes(1);
    mockTemporalStart.mockClear();
    mockDbFind.mockReset();
  });
});
