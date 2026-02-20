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
});
