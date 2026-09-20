/**
 * fractal-email-send seed guardrails.
 *
 * The Fractal notification workflow must email only actionable failure events
 * (build.failed, service.crashed, service.resource_warning). deploy.succeeded is
 * routine success with no Herald template: routing it produced a 400
 * ("Unknown templateId: deploy-succeeded") on every fleet deploy and spawned a
 * needless workflow run per event. These assertions pin that deploy.succeeded is
 * dropped at the routing layer AND that no render branch references the missing
 * template, so a future edit cannot silently re-introduce the storm.
 */

import { describe, expect, it } from "bun:test";

import { eventWorkflows } from "lib/db/seeds/eventWorkflows.seed";

describe("fractal-email-send seed", () => {
  const def = eventWorkflows.find((w) => w.name === "fractal-email-send");

  it("is seeded", () => {
    expect(def).toBeDefined();
  });

  it("excludes deploy.succeeded from routing while still gating on owner", () => {
    const route = def?.routes.find((r) => r.typePattern === "fractal.*");
    expect(route?.celCondition).toContain(
      'event.type != "fractal.deploy.succeeded"',
    );
    expect(route?.celCondition).toContain("has(event.data.owner)");
  });

  it("has no deploy-succeeded render branch", () => {
    expect(JSON.stringify(def?.definition)).not.toContain("deploy-succeeded");
  });

  it("still handles the actionable failure notifications", () => {
    const src = JSON.stringify(def?.definition);
    expect(src).toContain("build-failed");
    expect(src).toContain("service-crashed");
    expect(src).toContain("resource-warning");
  });
});
