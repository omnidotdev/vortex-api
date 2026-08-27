import { describe, expect, test } from "bun:test";

import { HERALD_CHRONICLE_SUBSCRIPTIONS } from "lib/db/seeds/eventSubscriptions.seed";
import { matchGlobPattern } from "lib/graphql/plugins/publishEvent.plugin";

/**
 * Herald forwards its audit events to Chronicle but MUST NOT forward its
 * high-volume `herald.message.*` delivery telemetry (up to 1M/mo on Pro), which
 * is not audit data and would flood the audit log. `matchGlobPattern` treats
 * `*` as `.*`, so a blanket `herald.*` cannot exclude message events - hence a
 * scoped pattern per audited entity.
 */
describe("Herald Chronicle subscriptions", () => {
  const patterns = HERALD_CHRONICLE_SUBSCRIPTIONS.map((s) => s.typePattern);

  test("cover the emitted audit event types", () => {
    const auditTypes = [
      "herald.sending_domain.created",
      "herald.sending_domain.verified",
      "herald.sending_domain.deleted",
      "herald.api_key.created",
      "herald.api_key.revoked",
    ];

    for (const type of auditTypes) {
      expect(patterns.some((pattern) => matchGlobPattern(pattern, type))).toBe(
        true,
      );
    }
  });

  test("do NOT match the high-volume message delivery stream", () => {
    const messageTypes = [
      "herald.message.delivered",
      "herald.message.bounced",
      "herald.message.complained",
    ];

    for (const type of messageTypes) {
      expect(patterns.some((pattern) => matchGlobPattern(pattern, type))).toBe(
        false,
      );
    }
  });

  test("have stable, unique subscription names (idempotent re-seed keys)", () => {
    const names = HERALD_CHRONICLE_SUBSCRIPTIONS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names)
      expect(name).toMatch(/^chronicle-audit-log-herald/);
  });
});
