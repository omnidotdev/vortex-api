import { describe, expect, test } from "bun:test";

import {
  IDP_EVENT_TRANSFORM,
  fractalSubscriptions,
  keystoneSubscriptions,
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
