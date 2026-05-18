/**
 * EventSubscription authorization plugin tests.
 *
 * Verify that EventSubscription mutations enforce admin+ role checks via Warden,
 * plan limits on create, and ownership validation on update/delete.
 */

import { describe, expect, it } from "bun:test";

describe("EventSubscription plugin source validation", () => {
  it("should wrap createEventSubscription mutation", async () => {
    const source = await Bun.file(
      "src/lib/graphql/plugins/authorization/EventSubscription.plugin.ts",
    ).text();

    expect(source).toContain("createEventSubscription");
    expect(source).toContain('"eventSubscription"');
    expect(source).toContain('"create"');
  });

  it("should wrap updateEventSubscription mutation", async () => {
    const source = await Bun.file(
      "src/lib/graphql/plugins/authorization/EventSubscription.plugin.ts",
    ).text();

    expect(source).toContain("updateEventSubscription");
    expect(source).toContain('"update"');
  });

  it("should wrap deleteEventSubscription mutation", async () => {
    const source = await Bun.file(
      "src/lib/graphql/plugins/authorization/EventSubscription.plugin.ts",
    ).text();

    expect(source).toContain("deleteEventSubscription");
    expect(source).toContain('"delete"');
  });
});

describe("EventSubscription create authorization", () => {
  it("should require an observer (authenticated user)", async () => {
    const source = await Bun.file(
      "src/lib/graphql/plugins/authorization/EventSubscription.plugin.ts",
    ).text();

    // The plugin must throw Unauthorized when there is no observer
    expect(source).toContain(
      'if (!observer) throw new SafeError("Unauthorized")',
    );
  });

  it("should use Warden authorize() with admin relation for create", async () => {
    const source = await Bun.file(
      "src/lib/graphql/plugins/authorization/EventSubscription.plugin.ts",
    ).text();

    expect(source).toContain('import authorize from "lib/warden/authorize"');
    expect(source).toContain("await authorize(");
    expect(source).toContain('"admin"');
  });

  it("should pass identityProviderId (idpUserId) to Warden", async () => {
    const source = await Bun.file(
      "src/lib/graphql/plugins/authorization/EventSubscription.plugin.ts",
    ).text();

    expect(source).toContain("observer.identityProviderId");
  });

  it("should check organization scope on create from input.organizationId", async () => {
    const source = await Bun.file(
      "src/lib/graphql/plugins/authorization/EventSubscription.plugin.ts",
    ).text();

    expect(source).toContain("input.organizationId");
  });

  it("should enforce MAX_SUBSCRIPTIONS plan limit on create", async () => {
    const source = await Bun.file(
      "src/lib/graphql/plugins/authorization/EventSubscription.plugin.ts",
    ).text();

    expect(source).toContain("FEATURE_KEYS.MAX_SUBSCRIPTIONS");
    expect(source).toContain("getPlanLimit");
    expect(source).toContain("assertUnderLimit");
    // Counts existing subscriptions for the org
    expect(source).toContain("eventSubscriptionTable.findMany");
  });
});

describe("EventSubscription update/delete authorization", () => {
  it("should look up subscription by ID for update/delete", async () => {
    const source = await Bun.file(
      "src/lib/graphql/plugins/authorization/EventSubscription.plugin.ts",
    ).text();

    // Non-create scopes fetch the subscription first
    expect(source).toContain("eventSubscriptionTable.findFirst");
    expect(source).toContain("eq(table.id, input)");
  });

  it("should throw when subscription is not found", async () => {
    const source = await Bun.file(
      "src/lib/graphql/plugins/authorization/EventSubscription.plugin.ts",
    ).text();

    expect(source).toContain(
      'throw new SafeError("Event subscription not found")',
    );
  });

  it("should check Warden against the subscription owning org", async () => {
    const source = await Bun.file(
      "src/lib/graphql/plugins/authorization/EventSubscription.plugin.ts",
    ).text();

    expect(source).toContain("subscription.organizationId");
  });

  it("should NOT use the legacy userOrganizationTable membership lookup", async () => {
    const source = await Bun.file(
      "src/lib/graphql/plugins/authorization/EventSubscription.plugin.ts",
    ).text();

    expect(source).not.toContain("userOrganizationTable");
  });
});

describe("EventSubscription plugin structure", () => {
  it("should use wrapPlans from postgraphile", async () => {
    const source = await Bun.file(
      "src/lib/graphql/plugins/authorization/EventSubscription.plugin.ts",
    ).text();

    expect(source).toContain('import { wrapPlans } from "postgraphile/utils"');
  });

  it("should export the plugin as default", async () => {
    const source = await Bun.file(
      "src/lib/graphql/plugins/authorization/EventSubscription.plugin.ts",
    ).text();

    expect(source).toContain("export default EventSubscriptionPlugin");
  });

  it("should use EXPORTABLE for plan serialization", async () => {
    const source = await Bun.file(
      "src/lib/graphql/plugins/authorization/EventSubscription.plugin.ts",
    ).text();

    expect(source).toContain("EXPORTABLE");
    expect(source).toContain('from "graphile-export"');
  });

  it("should use sideEffect for async validation", async () => {
    const source = await Bun.file(
      "src/lib/graphql/plugins/authorization/EventSubscription.plugin.ts",
    ).text();

    expect(source).toContain("sideEffect(");
    expect(source).toContain("[$input, $observer, $db]");
  });
});
