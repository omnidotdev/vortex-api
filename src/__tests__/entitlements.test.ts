import { describe, expect, it, mock } from "bun:test";

import { SafeError } from "postgraphile/grafast";

mock.module("lib/config/env.config", () => ({
  DATABASE_URL: "postgres://test",
  AUTHZ_API_URL: "http://warden.test",
  AUTHZ_SERVICE_KEY: undefined,
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

mock.module("lib/db/db", () => ({
  dbPool: {},
  pgPool: { end: async () => {} },
}));

mock.module("lib/providers", () => ({
  billing: {},
}));

const { assertUnderLimit } = await import("lib/entitlements/enforce");

describe("assertUnderLimit", () => {
  it("should throw SafeError when count meets limit", () => {
    expect(() => assertUnderLimit(5, 5, "workflows")).toThrow(SafeError);
  });

  it("should throw SafeError when count exceeds limit", () => {
    expect(() => assertUnderLimit(5, 10, "workflows")).toThrow(SafeError);
  });

  it("should include count and limit in error message", () => {
    try {
      assertUnderLimit(5, 10, "workflows");
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect((err as Error).message).toContain("10/5");
      expect((err as Error).message).toContain("Upgrade your plan");
    }
  });

  it("should not throw when count is under limit", () => {
    expect(() => assertUnderLimit(5, 2, "workflows")).not.toThrow();
  });

  it("should not throw when limit is -1 (unlimited)", () => {
    expect(() => assertUnderLimit(-1, 999, "workflows")).not.toThrow();
  });

  it("should not throw when count is 0", () => {
    expect(() => assertUnderLimit(5, 0, "workflows")).not.toThrow();
  });
});
