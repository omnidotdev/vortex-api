import { describe, expect, test } from "bun:test";

import { resolveEventOrg } from "lib/auth/resolveAuth";

describe("resolveEventOrg (service-to-service org delegation)", () => {
  test("a service key may act on behalf of another org via the header", () => {
    expect(
      resolveEventOrg(
        { organizationId: "service-org", isServiceKey: true },
        "customer-org",
      ),
    ).toBe("customer-org");
  });

  test("a service key with no header uses its own org", () => {
    expect(
      resolveEventOrg(
        { organizationId: "service-org", isServiceKey: true },
        undefined,
      ),
    ).toBe("service-org");
  });

  test("a tenant key cannot delegate -- the header is ignored", () => {
    expect(
      resolveEventOrg(
        { organizationId: "tenant-org", isServiceKey: false },
        "some-other-org",
      ),
    ).toBe("tenant-org");
    expect(
      resolveEventOrg({ organizationId: "tenant-org" }, "some-other-org"),
    ).toBe("tenant-org");
  });
});
