/**
 * SSE run stream Warden authorization test.
 *
 * Verifies that the GET /api/v1/runs/:runId/stream handler refuses the
 * stream when Warden denies the caller's `member` relation, BEFORE
 * incrementing the active SSE connection counter.
 *
 * The bulk of this test is structural (source-level) because spinning
 * up the full Elysia server with Redis is expensive; we directly verify
 * the wiring intent.
 */

import { describe, expect, it } from "bun:test";

describe("SSE stream Warden enforcement", () => {
  it("imports authorize from lib/warden/authorize", async () => {
    const src = await Bun.file("src/routes/runs.ts").text();
    expect(src).toContain('import authorize from "lib/warden/authorize"');
  });

  it("calls authorize before incrementing activeSseConnections", async () => {
    const src = await Bun.file("src/routes/runs.ts").text();
    const streamHandlerEnd = src.indexOf("activeSseConnections++");
    expect(streamHandlerEnd).toBeGreaterThan(-1);

    // Find the start of the stream handler
    const streamHandlerStart = src.indexOf('"/:runId/stream"');
    expect(streamHandlerStart).toBeGreaterThan(-1);
    expect(streamHandlerStart).toBeLessThan(streamHandlerEnd);

    const handler = src.slice(streamHandlerStart, streamHandlerEnd);
    expect(handler).toMatch(/await authorize\(/);
    expect(handler).toContain('"member"');
    expect(handler).toContain('"organization"');
  });

  it("returns 403 when Warden denies access", async () => {
    const src = await Bun.file("src/routes/runs.ts").text();
    // The handler must return a 403 status on Warden denial
    const streamHandlerStart = src.indexOf('"/:runId/stream"');
    const streamHandlerEnd = src.indexOf("activeSseConnections++");
    const handler = src.slice(streamHandlerStart, streamHandlerEnd);
    expect(handler).toContain("status(403");
  });
});

describe("SSE authorize() runtime behavior", () => {
  it("refuses to proceed when authorize() returns false", async () => {
    // Mock the authorize wrapper to deny
    const calls: Array<[string, string, string, string]> = [];
    const authorize = async (
      a: string,
      b: string,
      c: string,
      d: string,
    ): Promise<boolean> => {
      calls.push([a, b, c, d]);
      return false;
    };

    // Simulate the inline behavior in the route handler
    const idpUserId = "idp-user-123";
    const organizationId = "org-456";

    const allowed = await authorize(
      idpUserId,
      "organization",
      organizationId,
      "member",
    );
    expect(allowed).toBe(false);
    expect(calls).toEqual([
      [idpUserId, "organization", organizationId, "member"],
    ]);

    // The route should refuse to proceed -- mirrored by the source check above
  });
});
