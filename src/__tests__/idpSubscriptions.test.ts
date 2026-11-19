import { describe, expect, test } from "bun:test";

import {
  IDP_EVENT_TRANSFORM,
  aetherSubscriptions,
  fractalSubscriptions,
  keystoneSubscriptions,
  workspaceDeletionReceivers,
  workspaceDeletionSubscriptions,
} from "lib/db/seeds/eventSubscriptions.seed";
import { matchGlobPattern } from "lib/graphql/plugins/publishEvent.plugin";

describe("Keystone and Fractal identity subscriptions", () => {
  test("Keystone gets workspace deletions, member departures, and account deletions", () => {
    const subs = keystoneSubscriptions({
      apiUrl: "https://api.keystone.omni.dev",
      secret: "k-secret",
    });

    expect(subs.map((s) => [s.name, s.typePattern])).toEqual([
      ["keystone-idp-organization-deleted", "gatekeeper.organization.deleted"],
      ["keystone-idp-member-removed", "gatekeeper.member.removed"],
      ["keystone-idp-user-deleted", "gatekeeper.user.deleted"],
    ]);
    for (const sub of subs) {
      expect(sub).toMatchObject({
        sourcePattern: "omni.gatekeeper",
        targetUrl: "https://api.keystone.omni.dev/webhooks/idp",
        hmacSecret: "k-secret",
        signatureHeader: "x-idp-signature",
        payloadMode: "envelope",
        transform: IDP_EVENT_TRANSFORM,
      });
    }
  });

  test("Aether gets account and workspace deletions", () => {
    const subs = aetherSubscriptions({
      apiUrl: "https://api.billing.omni.dev",
      secret: "a-secret",
    });

    expect(subs.map((s) => [s.name, s.typePattern])).toEqual([
      ["aether-idp-user-deleted", "gatekeeper.user.deleted"],
      ["aether-idp-organization-deleted", "gatekeeper.organization.deleted"],
    ]);
    for (const sub of subs) {
      expect(sub).toMatchObject({
        sourcePattern: "omni.gatekeeper",
        targetUrl: "https://api.billing.omni.dev/webhooks/idp",
        hmacSecret: "a-secret",
        signatureHeader: "x-idp-signature",
        payloadMode: "envelope",
        transform: IDP_EVENT_TRANSFORM,
      });
    }
  });

  test("Fractal gets workspace deletions only", () => {
    const subs = fractalSubscriptions({
      apiUrl: "https://api.fractal.omni.dev",
      secret: "f-secret",
    });

    expect(subs).toHaveLength(1);
    expect(subs[0]).toMatchObject({
      name: "fractal-idp-organization-deleted",
      typePattern: "gatekeeper.organization.deleted",
      targetUrl: "https://api.fractal.omni.dev/webhooks/idp",
      hmacSecret: "f-secret",
    });
  });

  test("each matches its own event type and nothing broader", () => {
    const [orgDeleted, memberRemoved] = keystoneSubscriptions({
      apiUrl: "https://k",
      secret: "s",
    });

    expect(
      matchGlobPattern(
        orgDeleted?.typePattern ?? "",
        "gatekeeper.organization.deleted",
      ),
    ).toBe(true);
    expect(
      matchGlobPattern(
        orgDeleted?.typePattern ?? "",
        "gatekeeper.organization.deletion_scheduled",
      ),
    ).toBe(false);
    expect(
      matchGlobPattern(
        memberRemoved?.typePattern ?? "",
        "gatekeeper.member.added",
      ),
    ).toBe(false);
  });

  test("the transform emits the eventType and ids the receivers dispatch on", () => {
    expect(IDP_EVENT_TRANSFORM).toContain(
      '"eventType": $substringAfter(type, "gatekeeper.")',
    );
    expect(IDP_EVENT_TRANSFORM).toContain(
      '"organizationId": data.organizationId',
    );
    expect(IDP_EVENT_TRANSFORM).toContain('"userId": data.userId');
  });
});

describe("workspace-deletion subscriptions", () => {
  const receiver = (product: string, apiUrl?: string, secret?: string) => ({
    product,
    apiUrl,
    secret,
    receiverSecret: "IDP_WEBHOOK_SECRET",
    purpose: "delete the workspace's data",
  });

  test("each configured product gets workspace deletions at its /webhooks/idp", () => {
    const subs = workspaceDeletionSubscriptions(
      [
        receiver("signet", "https://api.signet.omni.dev/", "s-secret"),
        receiver("halo", "https://api.halo.omni.dev", "h-secret"),
      ],
      () => {},
    );

    expect(subs.map((s) => [s.name, s.targetUrl, s.hmacSecret])).toEqual([
      [
        "signet-idp-organization-deleted",
        "https://api.signet.omni.dev/webhooks/idp",
        "s-secret",
      ],
      [
        "halo-idp-organization-deleted",
        "https://api.halo.omni.dev/webhooks/idp",
        "h-secret",
      ],
    ]);
    for (const sub of subs) {
      expect(sub).toMatchObject({
        sourcePattern: "omni.gatekeeper",
        typePattern: "gatekeeper.organization.deleted",
        signatureHeader: "x-idp-signature",
        payloadMode: "envelope",
        transform: IDP_EVENT_TRANSFORM,
      });
    }
  });

  test("a product missing its URL or secret is left out, with a warning", () => {
    const warnings: string[] = [];
    const subs = workspaceDeletionSubscriptions(
      [
        receiver("myfi", "https://api.myfi.omni.dev", undefined),
        receiver("mantle", undefined, "m-secret"),
      ],
      (message) => warnings.push(message),
    );

    expect(subs).toEqual([]);
    expect(warnings).toEqual([
      "MYFI_API_URL / MYFI_IDP_WEBHOOK_SECRET not set, myfi workspace-deletion delivery disabled",
      "MANTLE_API_URL / MANTLE_IDP_WEBHOOK_SECRET not set, mantle workspace-deletion delivery disabled",
    ]);
  });

  test("covers every product that deletes workspace data on this event", () => {
    expect(workspaceDeletionReceivers().map((r) => r.product)).toEqual([
      "herald",
      "signet",
      "myfi",
      "mantle",
      "crystal",
      "halo",
    ]);
  });
});
