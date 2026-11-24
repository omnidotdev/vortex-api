import { describe, expect, test } from "bun:test";

import { consentSourcesSubscriptions } from "lib/db/seeds/eventSubscriptions.seed";
import { matchGlobPattern } from "lib/graphql/plugins/publishEvent.plugin";

/**
 * The marketing consent sources (the sign-up checkbox and an email
 * unsubscribe) reach omni-api's consent ledger through one signed receiver
 */
describe("omni-api consent source subscriptions", () => {
  const subs = consentSourcesSubscriptions({
    apiUrl: "https://api.omni.dev/",
    secret: "cs-secret",
  });

  test("deliver sign-ups and email unsubscribes from their producers", () => {
    expect(subs.map((s) => [s.name, s.sourcePattern, s.typePattern])).toEqual([
      ["omni-api-consent-signup", "omni.gatekeeper", "gatekeeper.user.created"],
      [
        "omni-api-consent-email-unsubscribe",
        "omni.herald",
        "herald.contact.unsubscribed",
      ],
    ]);
  });

  test("sign the untransformed envelope for omni-api's consent-sources route", () => {
    for (const sub of subs) {
      expect(sub).toMatchObject({
        targetUrl: "https://api.omni.dev/webhooks/consent-sources",
        hmacSecret: "cs-secret",
        signatureHeader: "x-vortex-signature",
        payloadMode: "envelope",
        transform: null,
      });
    }
  });

  test("match only the event types omni-api records", () => {
    const patterns = subs.map((s) => s.typePattern);
    const matches = (type: string) =>
      patterns.some((pattern) => matchGlobPattern(pattern, type));

    expect(matches("gatekeeper.user.created")).toBe(true);
    expect(matches("herald.contact.unsubscribed")).toBe(true);
    expect(matches("gatekeeper.user.deleted")).toBe(false);
    expect(matches("herald.contact.subscribed")).toBe(false);
    expect(matches("herald.message.delivered")).toBe(false);
  });

  test("have stable, unique names (idempotent re-seed keys)", () => {
    const names = subs.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
