import { describe, expect, test } from "bun:test";

import isServiceKeyRequest from "lib/auth/isServiceKeyRequest";

const SERVICE_KEY = "a".repeat(64);

/**
 * The global rate limiter skips first-party services, which share one egress
 * IP, so one service's burst can never reject another service's events
 */
describe("isServiceKeyRequest", () => {
  test("matches the service key, bare or as a bearer token", () => {
    expect(isServiceKeyRequest(SERVICE_KEY, SERVICE_KEY)).toBe(true);
    expect(isServiceKeyRequest(`Bearer ${SERVICE_KEY}`, SERVICE_KEY)).toBe(
      true,
    );
  });

  test("does not match a tenant key or another value", () => {
    expect(isServiceKeyRequest("Bearer omni_tenantkey", SERVICE_KEY)).toBe(
      false,
    );
    expect(isServiceKeyRequest(`${SERVICE_KEY}x`, SERVICE_KEY)).toBe(false);
  });

  test("never matches without a header or a configured key", () => {
    expect(isServiceKeyRequest(null, SERVICE_KEY)).toBe(false);
    expect(isServiceKeyRequest(undefined, SERVICE_KEY)).toBe(false);
    expect(isServiceKeyRequest("", SERVICE_KEY)).toBe(false);
    expect(isServiceKeyRequest(SERVICE_KEY, undefined)).toBe(false);
    expect(isServiceKeyRequest(SERVICE_KEY, "")).toBe(false);
  });
});
