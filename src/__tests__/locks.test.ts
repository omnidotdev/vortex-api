import { afterEach, describe, expect, it, mock } from "bun:test";

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
  },
}));

// Mock redis to prevent real connection attempts
mock.module("redis", () => ({
  createClient: () => null,
}));

// Mock cache client (non-null = cache configured)
const mockSet = mock<() => Promise<string | null>>(async () => "OK");
const mockEval = mock<() => Promise<number>>(async () => 1);

mock.module("lib/cache/client", () => ({
  cacheClient: { set: mockSet, eval: mockEval },
}));

// Import after mocks
const { acquireWorkflowCronLock, releaseWorkflowCronLock } = await import(
  "../lib/cache/locks"
);

afterEach(() => {
  mockSet.mockReset();
  mockEval.mockReset();
  mockSet.mockImplementation(async () => "OK");
  mockEval.mockImplementation(async () => 1);
});

describe("acquireWorkflowCronLock", () => {
  it("returns a token on success", async () => {
    const token = await acquireWorkflowCronLock("wf-1");

    expect(token).toBeString();
    expect(token).not.toBeEmpty();
    expect(mockSet).toHaveBeenCalledTimes(1);

    // Verify correct key pattern and SET NX EX args
    const [key, value, opts] = mockSet.mock.calls[0] as unknown as [
      string,
      string,
      { NX: boolean; EX: number },
    ];
    expect(key).toBe("vortex:cron:lock:wf-1");
    expect(value).toBe(token as string);
    expect(opts.NX).toBe(true);
    expect(opts.EX).toBe(90);
  });

  it("returns null when lock is already held", async () => {
    mockSet.mockImplementation(async () => null);

    const token = await acquireWorkflowCronLock("wf-2");

    expect(token).toBeNull();
    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it("returns null on cache error", async () => {
    mockSet.mockImplementation(async () => {
      throw new Error("connection refused");
    });

    const token = await acquireWorkflowCronLock("wf-3");

    expect(token).toBeNull();
  });
});

describe("releaseWorkflowCronLock", () => {
  it("returns true when token matches", async () => {
    const released = await releaseWorkflowCronLock("wf-1", "my-token");

    expect(released).toBe(true);
    expect(mockEval).toHaveBeenCalledTimes(1);

    // Verify Lua compare-and-delete script arguments
    const [script, opts] = mockEval.mock.calls[0] as unknown as [
      string,
      { keys: string[]; arguments: string[] },
    ];
    expect(script).toContain("redis.call('get'");
    expect(script).toContain("redis.call('del'");
    expect(opts.keys).toEqual(["vortex:cron:lock:wf-1"]);
    expect(opts.arguments).toEqual(["my-token"]);
  });

  it("returns false when token does not match", async () => {
    mockEval.mockImplementation(async () => 0);

    const released = await releaseWorkflowCronLock("wf-2", "wrong-token");

    expect(released).toBe(false);
  });

  it("returns false on cache error", async () => {
    mockEval.mockImplementation(async () => {
      throw new Error("connection refused");
    });

    const released = await releaseWorkflowCronLock("wf-3", "my-token");

    expect(released).toBe(false);
  });
});
