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

// Mock iovalkey to prevent real connection attempts
mock.module("iovalkey", () => ({
  default: class MockValkey {},
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

    // Verify correct key pattern and SET EX NX positional args
    const [key, value, exFlag, ttl, nxFlag] = mockSet.mock
      .calls[0] as unknown as [string, string, string, number, string];
    expect(key).toBe("vortex:cron:lock:wf-1");
    expect(value).toBe(token as string);
    expect(exFlag).toBe("EX");
    expect(ttl).toBe(90);
    expect(nxFlag).toBe("NX");
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

describe("concurrent lock acquisition", () => {
  it("should only allow one caller to acquire a workflow lock", async () => {
    // Simulate NX: first SET succeeds, second returns null (key already exists)
    let callCount = 0;

    mockSet.mockImplementation(async () => {
      callCount++;
      return callCount === 1 ? "OK" : null;
    });

    const [resultA, resultB] = await Promise.all([
      acquireWorkflowCronLock("wf-123"),
      acquireWorkflowCronLock("wf-123"),
    ]);

    const results = [resultA, resultB];
    const winners = results.filter((r) => r !== null);
    const losers = results.filter((r) => r === null);

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(winners[0]).toBeString();
    expect(mockSet).toHaveBeenCalledTimes(2);
  });

  it("should allow locking different workflows concurrently", async () => {
    // Both SET NX calls succeed because they target different keys
    mockSet.mockImplementation(async () => "OK");

    const [tokenA, tokenB] = await Promise.all([
      acquireWorkflowCronLock("wf-aaa"),
      acquireWorkflowCronLock("wf-bbb"),
    ]);

    expect(tokenA).toBeString();
    expect(tokenB).toBeString();
    expect(tokenA).not.toBe(tokenB);
    expect(mockSet).toHaveBeenCalledTimes(2);

    // Verify each call targeted the correct key
    const keys = mockSet.mock.calls.map(
      (call) => (call as unknown as [string])[0],
    );

    expect(keys).toContain("vortex:cron:lock:wf-aaa");
    expect(keys).toContain("vortex:cron:lock:wf-bbb");
  });
});

describe("releaseWorkflowCronLock", () => {
  it("returns true when token matches", async () => {
    const released = await releaseWorkflowCronLock("wf-1", "my-token");

    expect(released).toBe(true);
    expect(mockEval).toHaveBeenCalledTimes(1);

    // Verify Lua compare-and-delete script positional arguments
    const [script, numKeys, key, arg] = mockEval.mock.calls[0] as unknown as [
      string,
      number,
      string,
      string,
    ];
    expect(script).toContain("redis.call('get'");
    expect(script).toContain("redis.call('del'");
    expect(numKeys).toBe(1);
    expect(key).toBe("vortex:cron:lock:wf-1");
    expect(arg).toBe("my-token");
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
