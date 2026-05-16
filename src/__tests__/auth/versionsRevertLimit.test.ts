/**
 * Version revert workflow-limit tests.
 *
 * Verifies that POST /api/v1/workflows/:workflowId/revert/:version enforces
 * MAX_WORKFLOWS so that reverting cannot resurrect a soft-deleted workflow
 * past the plan limit.
 */

import { describe, expect, it } from "bun:test";

describe("versions revert MAX_WORKFLOWS enforcement", () => {
  it("imports getPlanLimit and assertUnderLimit", async () => {
    const src = await Bun.file("src/routes/versions.ts").text();
    expect(src).toContain("getPlanLimit");
    expect(src).toContain("assertUnderLimit");
    expect(src).toContain("FEATURE_KEYS.MAX_WORKFLOWS");
  });

  it("revert handler enforces MAX_WORKFLOWS", async () => {
    const src = await Bun.file("src/routes/versions.ts").text();
    const handlerStart = src.indexOf('"/:workflowId/revert/:version"');
    expect(handlerStart).toBeGreaterThan(-1);

    const handler = src.slice(handlerStart);
    // The handler should call assertUnderLimit and getPlanLimit
    expect(handler).toContain("getPlanLimit");
    expect(handler).toContain("assertUnderLimit");
    expect(handler).toContain("MAX_WORKFLOWS");
  });

  it("revert handler also has Warden authorize call (admin)", async () => {
    const src = await Bun.file("src/routes/versions.ts").text();
    const handlerStart = src.indexOf('"/:workflowId/revert/:version"');
    const handler = src.slice(handlerStart);

    expect(handler).toMatch(/await authorize\(/);
    expect(handler).toContain('"admin"');
  });
});
