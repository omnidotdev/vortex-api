import { describe, expect, test } from "bun:test";

import {
  MYFI_MANTLE_TRANSFORM,
  myfiMantleSubscriptions,
} from "lib/db/seeds/eventSubscriptions.seed";
import { matchGlobPattern } from "lib/graphql/plugins/publishEvent.plugin";

const subs = myfiMantleSubscriptions({
  apiUrl: "https://api.myfi.omni.dev/",
  secret: "mantle-secret",
});

const matching = (type: string, source = "omni.mantle") =>
  subs.filter(
    (sub) =>
      matchGlobPattern(sub.typePattern, type) &&
      matchGlobPattern(sub.sourcePattern, source),
  );

describe("MyFi Mantle subscriptions", () => {
  test("deliver each ledger entity to MyFi's Mantle webhook, signed the way MyFi verifies", () => {
    expect(subs.map((s) => [s.name, s.typePattern])).toEqual([
      ["myfi-mantle-invoices", "mantle.invoice.*"],
      ["myfi-mantle-payments", "mantle.payment.*"],
      ["myfi-mantle-credits", "mantle.credit.*"],
      ["myfi-mantle-quotes", "mantle.quote.*"],
    ]);

    for (const sub of subs) {
      expect(sub).toMatchObject({
        sourcePattern: "omni.mantle",
        // trailing slash on the base URL is trimmed
        targetUrl: "https://api.myfi.omni.dev/api/webhooks/mantle",
        hmacSecret: "mantle-secret",
        // MyFi reads X-Webhook-Signature (headers are case-insensitive)
        signatureHeader: "x-webhook-signature",
        // envelope so the transform can carry the CloudEvent type as `event`
        payloadMode: "envelope",
        transform: MYFI_MANTLE_TRANSFORM,
      });
    }
  });

  test("reshape the envelope to MyFi's { event, data } body", () => {
    expect(MYFI_MANTLE_TRANSFORM).toContain('"event": type');
    expect(MYFI_MANTLE_TRANSFORM).toContain('"data": data');
  });

  test("every Mantle event MyFi books reaches it exactly once", () => {
    for (const type of [
      "mantle.invoice.created",
      "mantle.invoice.updated",
      "mantle.invoice.deleted",
      "mantle.payment.created",
      "mantle.payment.updated",
      "mantle.payment.deleted",
      "mantle.credit.issued",
      "mantle.credit.applied",
      "mantle.quote.updated",
    ]) {
      expect(matching(type)).toHaveLength(1);
    }
  });

  test("Mantle events MyFi does not book, and other sources, are not delivered", () => {
    for (const type of [
      "mantle.company.created",
      "mantle.person.updated",
      "mantle.product.created",
      "mantle.documentNumberingConfig.updated",
    ]) {
      expect(matching(type)).toHaveLength(0);
    }

    expect(matching("mantle.invoice.created", "omni.halo")).toHaveLength(0);
  });
});
