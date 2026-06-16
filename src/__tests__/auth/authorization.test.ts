/**
 * Authorization (Warden) integration tests.
 *
 * Verify that all protected routes enforce Warden authZ checks
 * and that the authorize wrapper is fail-closed.
 */

import { describe, expect, it } from "bun:test";

import authorize from "lib/warden/authorize";

describe("authorize wrapper", () => {
  it("should return true when authz is disabled", async () => {
    // No authz URL means authz is off -> permissive
    const result = await authorize(
      "user-1",
      "organization",
      "org-1",
      "member",
      {
        authzApiUrl: "",
      },
    );
    expect(result).toBe(true);
  });

  it("should return false (fail-closed) when Warden is unreachable", async () => {
    // An unreachable Warden surfaces as a throwing permission check; the
    // wrapper must catch and deny rather than fail open
    const result = await authorize(
      "user-1",
      "organization",
      "org-1",
      "member",
      {
        authzApiUrl: "http://warden-unreachable.test",
        checkPermission: async () => {
          throw new Error("Connection refused");
        },
      },
    );
    expect(result).toBe(false);
  });
});

describe("API key idpUserId propagation", () => {
  it("apiKey.ts should set idpUserId from Gatekeeper key userId", async () => {
    const source = await Bun.file("src/lib/auth/apiKey.ts").text();
    // The fix: API keys must propagate userId as idpUserId so Warden
    // checks work for API key holders, not just session-based users
    expect(source).toContain("idpUserId: data.key.userId");
  });

  it("ApiKeyInfo type should include idpUserId", async () => {
    const source = await Bun.file("src/lib/auth/apiKey.ts").text();
    expect(source).toContain("idpUserId?: string");
  });
});

describe("user seat enforcement", () => {
  it("IDP webhooks should hard-enforce MAX_USERS limit", async () => {
    const source = await Bun.file("src/lib/idp/webhooks.ts").text();
    // Should throw when over limit, not just warn
    expect(source).toContain("Member limit reached");
    expect(source).toContain("throw new Error");
  });
});

describe("route authZ coverage", () => {
  it("functions.ts should import authorize", async () => {
    const source = await Bun.file("src/routes/functions.ts").text();
    expect(source).toContain('import authorize from "lib/warden/authorize"');
  });

  it("functions.ts should authorize register, invoke, and delete", async () => {
    const source = await Bun.file("src/routes/functions.ts").text();

    // Count authorize calls - should have 3 (register, invoke, delete)
    const authorizeCallCount = (source.match(/await authorize\(/g) || [])
      .length;
    expect(authorizeCallCount).toBeGreaterThanOrEqual(3);
  });

  it("functions.ts should enforce MAX_FUNCTIONS limit", async () => {
    const source = await Bun.file("src/routes/functions.ts").text();
    expect(source).toContain("FEATURE_KEYS.MAX_FUNCTIONS");
    expect(source).toContain("getPlanLimit");
  });

  it("runs.ts should import authorize", async () => {
    const source = await Bun.file("src/routes/runs.ts").text();
    expect(source).toContain('import authorize from "lib/warden/authorize"');
  });

  it("runs.ts should authorize retry and cancel", async () => {
    const source = await Bun.file("src/routes/runs.ts").text();

    // Should have 2 authorize calls (retry, cancel)
    const authorizeCallCount = (source.match(/await authorize\(/g) || [])
      .length;
    expect(authorizeCallCount).toBeGreaterThanOrEqual(2);
  });

  it("subscriptions.ts should enforce MAX_SUBSCRIPTIONS limit", async () => {
    const source = await Bun.file("src/routes/subscriptions.ts").text();
    expect(source).toContain("FEATURE_KEYS.MAX_SUBSCRIPTIONS");
    expect(source).toContain("getPlanLimit");
  });

  it("dlq.ts should import authorize", async () => {
    const source = await Bun.file("src/routes/dlq.ts").text();
    expect(source).toContain('import authorize from "lib/warden/authorize"');
  });

  it("dlq.ts should authorize all write operations", async () => {
    const source = await Bun.file("src/routes/dlq.ts").text();

    // Should have 4 authorize calls (replay, bulk replay, discard, bulk discard)
    const authorizeCallCount = (source.match(/await authorize\(/g) || [])
      .length;
    expect(authorizeCallCount).toBeGreaterThanOrEqual(4);
  });

  it("versions.ts should authorize revert", async () => {
    const source = await Bun.file("src/routes/versions.ts").text();
    expect(source).toContain('import authorize from "lib/warden/authorize"');
    expect(source).toContain("await authorize(");
  });

  it("workflows.ts should authorize export operations", async () => {
    const source = await Bun.file("src/routes/workflows.ts").text();
    expect(source).toContain('import authorize from "lib/warden/authorize"');

    // Should have 2 authorize calls (WASM export, Spin export)
    const authorizeCallCount = (source.match(/await authorize\(/g) || [])
      .length;
    expect(authorizeCallCount).toBeGreaterThanOrEqual(2);
  });

  it("stats.ts should import authorize", async () => {
    const source = await Bun.file("src/routes/stats.ts").text();
    expect(source).toContain('import authorize from "lib/warden/authorize"');
  });

  it("stats.ts should authorize all stat endpoints", async () => {
    const source = await Bun.file("src/routes/stats.ts").text();

    // Should have 4 authorize calls (per-workflow, org, timeline, errors)
    const authorizeCallCount = (source.match(/await authorize\(/g) || [])
      .length;
    expect(authorizeCallCount).toBeGreaterThanOrEqual(4);
  });

  it("permissions.ts should import authorize", async () => {
    const source = await Bun.file("src/routes/permissions.ts").text();
    expect(source).toContain('import authorize from "lib/warden/authorize"');
  });

  it("permissions.ts should authorize list, grant, and revoke", async () => {
    const source = await Bun.file("src/routes/permissions.ts").text();

    // Should have 3 authorize calls (list, grant, revoke)
    const authorizeCallCount = (source.match(/await authorize\(/g) || [])
      .length;
    expect(authorizeCallCount).toBeGreaterThanOrEqual(3);
  });

  it("members.ts should import authorize", async () => {
    const source = await Bun.file("src/routes/members.ts").text();
    expect(source).toContain('import authorize from "lib/warden/authorize"');
  });

  it("members.ts should authorize member listing", async () => {
    const source = await Bun.file("src/routes/members.ts").text();
    expect(source).toContain("await authorize(");
  });

  it("authorize wrapper should be fail-closed (not fail-open)", async () => {
    const source = await Bun.file("src/lib/warden/authorize.ts").text();

    // Should NOT return true in catch block
    expect(source).not.toMatch(/catch.*\{[\s\S]*?return true/);
    // Should return false on error
    expect(source).toContain("return false");
  });
});
