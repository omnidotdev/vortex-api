import { describe, expect, test } from "bun:test";

import {
  BIFROST_ENTITLEMENT_TRANSFORM,
  BIFROST_ORG_DELETED_TRANSFORM,
  bifrostSubscriptions,
} from "lib/db/seeds/eventSubscriptions.seed";
import { matchGlobPattern } from "lib/graphql/plugins/publishEvent.plugin";

const apiUrl = "https://api.bifrost.omni.dev";

describe("Bifrost subscriptions", () => {
  test("deliver entitlements to /webhooks/billing and org deletion to /webhooks/idp", () => {
    const [billing, idp] = bifrostSubscriptions({
      apiUrl,
      billingSecret: "billing-secret",
      idpSecret: "idp-secret",
    });

    expect(billing).toMatchObject({
      name: "bifrost-entitlements",
      sourcePattern: "omni.aether",
      targetUrl: `${apiUrl}/webhooks/billing`,
      hmacSecret: "billing-secret",
      signatureHeader: "x-billing-signature",
      payloadMode: "envelope",
      transform: BIFROST_ENTITLEMENT_TRANSFORM,
    });
    expect(idp).toMatchObject({
      name: "bifrost-idp-org-deleted",
      sourcePattern: "omni.gatekeeper",
      targetUrl: `${apiUrl}/webhooks/idp`,
      hmacSecret: "idp-secret",
      signatureHeader: "x-idp-signature",
      payloadMode: "envelope",
      transform: BIFROST_ORG_DELETED_TRANSFORM,
    });
  });

  test("match the emitted event types and nothing broader", () => {
    const [billing, idp] = bifrostSubscriptions({
      apiUrl,
      billingSecret: "b",
      idpSecret: "i",
    });

    for (const type of [
      "aether.entitlement.updated",
      "aether.entitlement.deleted",
    ])
      expect(matchGlobPattern(billing?.typePattern ?? "", type)).toBe(true);
    expect(
      matchGlobPattern(billing?.typePattern ?? "", "aether.billing.suspended"),
    ).toBe(false);

    expect(
      matchGlobPattern(
        idp?.typePattern ?? "",
        "gatekeeper.organization.deleted",
      ),
    ).toBe(true);
    expect(
      matchGlobPattern(
        idp?.typePattern ?? "",
        "gatekeeper.organization.updated",
      ),
    ).toBe(false);
  });

  test("skip a subscription whose secret is unset", () => {
    expect(
      bifrostSubscriptions({ apiUrl, billingSecret: "b" }).map((s) => s.name),
    ).toEqual(["bifrost-entitlements"]);
    expect(
      bifrostSubscriptions({ apiUrl, idpSecret: "i" }).map((s) => s.name),
    ).toEqual(["bifrost-idp-org-deleted"]);
    expect(bifrostSubscriptions({ apiUrl })).toEqual([]);
  });

  test("transforms emit the eventType the receivers switch on", () => {
    expect(BIFROST_ENTITLEMENT_TRANSFORM).toContain(
      '"eventType": $substringAfter(type, "aether.")',
    );
    expect(BIFROST_ENTITLEMENT_TRANSFORM).toContain('"productId": data.appId');
    expect(BIFROST_ORG_DELETED_TRANSFORM).toContain(
      '"eventType": "organization.deleted"',
    );
    expect(BIFROST_ORG_DELETED_TRANSFORM).toContain(
      '"organizationId": data.organizationId',
    );
  });
});
