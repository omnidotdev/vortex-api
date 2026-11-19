import { describe, expect, test } from "bun:test";

import { eventSubscriptionTable } from "lib/db/schema";
import seedEventSubscriptions, {
  RETIRED_SUBSCRIPTIONS,
  aetherSubscriptions,
  fractalSubscriptions,
  keystoneSubscriptions,
} from "lib/db/seeds/eventSubscriptions.seed";

describe("retired event subscriptions", () => {
  test("the legacy aether-idp user.* subscription is retired", () => {
    expect(RETIRED_SUBSCRIPTIONS).toContain("aether-idp");
  });

  test("a retired name is never one the seed still creates", () => {
    const seeded = [
      ...aetherSubscriptions({ apiUrl: "https://a", secret: "s" }),
      ...keystoneSubscriptions({ apiUrl: "https://k", secret: "s" }),
      ...fractalSubscriptions({ apiUrl: "https://f", secret: "s" }),
    ].map((sub) => sub.name);

    for (const name of RETIRED_SUBSCRIPTIONS) {
      expect(seeded).not.toContain(name);
    }
  });

  test("boot seeding deletes retired subscriptions", async () => {
    const deletedFrom: unknown[] = [];
    const db = {
      query: {
        eventSubscriptionTable: { findFirst: async () => ({ id: "x" }) },
      },
      update: () => ({ set: () => ({ where: async () => undefined }) }),
      insert: () => ({ values: async () => undefined }),
      delete: (table: unknown) => {
        deletedFrom.push(table);
        return {
          where: () => ({ returning: async () => [{ name: "aether-idp" }] }),
        };
      },
    };

    await seedEventSubscriptions(db, "platform-org");

    expect(deletedFrom).toEqual([eventSubscriptionTable]);
  });
});
