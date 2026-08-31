import { describe, expect, test } from "bun:test";

import {
  PLATFORM_EVENT_SOURCE,
  resolveEventSource,
} from "lib/auth/resolveAuth";

describe("resolveEventSource (event source pinning)", () => {
  test("the internal service principal may emit the reserved platform source", () => {
    expect(
      resolveEventSource(
        { name: "Service Key", isServiceKey: true },
        PLATFORM_EVENT_SOURCE,
      ),
    ).toBe(PLATFORM_EVENT_SOURCE);
  });

  test("a tenant/product key forging the platform source is rejected (null)", () => {
    expect(
      resolveEventSource(
        { name: "runa-prod-key", isServiceKey: false },
        PLATFORM_EVENT_SOURCE,
      ),
    ).toBeNull();
    // isServiceKey unset defaults to a non-service (tenant) principal
    expect(
      resolveEventSource({ name: "runa-prod-key" }, PLATFORM_EVENT_SOURCE),
    ).toBeNull();
  });

  test("a tenant/product key may set its own product source", () => {
    expect(resolveEventSource({ name: "runa-prod-key" }, "omni.runa")).toBe(
      "omni.runa",
    );
  });

  test("a service key may set an arbitrary (non-platform) source", () => {
    expect(
      resolveEventSource(
        { name: "Service Key", isServiceKey: true },
        "omni.fractal",
      ),
    ).toBe("omni.fractal");
  });

  test("defaults to the credential name when no source is supplied", () => {
    expect(resolveEventSource({ name: "runa-prod-key" }, undefined)).toBe(
      "runa-prod-key",
    );
    expect(resolveEventSource({ name: "runa-prod-key" }, "")).toBe(
      "runa-prod-key",
    );
  });

  test("falls back to 'unknown' when neither source nor name is present", () => {
    expect(resolveEventSource({}, undefined)).toBe("unknown");
  });
});
